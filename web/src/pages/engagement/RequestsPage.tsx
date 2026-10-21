import { useMemo, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Plus, Search, X, Paperclip, MessageSquare, FileText } from 'lucide-react'
import {
  Avatar,
  Button,
  DemoNote,
  EmptyState,
  Field,
  Input,
  KrTag,
  Modal,
  RequestStatusBadge,
  Select,
  Td,
  Textarea,
  Th,
  requestStatusMap,
} from '@/components/ui'
import { api } from '@/data/api'
import { useDocuments, useEngagement, useRequests, useToday, useUsers } from '@/data/hooks'
import { RequestAnalytics } from '@/components/RequestAnalytics'
import { RequestHistory, TagChips, TagEditor } from '@/components/RequestExtras'
import { addDays } from '@/domain/rules'
import type { AuditRequest, RequestStatus } from '@/domain/types'
import { cx, date, dateTime } from '@/lib/format'

const STATUSES = Object.keys(requestStatusMap) as RequestStatus[]
const CATEGORIES = ['일반', '현금', '매출', '매출채권', '매입', '재고', '유형자산', '차입금', '충당부채', '비용', '세무', '공시']

/** 한공회 감사조서 서식 기준 표준 PBC 항목(시연용 요약) */
const KICPA_TEMPLATE: { title: string; category: string; description: string }[] = [
  { title: '합계잔액시산표(결산 확정)', category: '일반', description: '결산 확정 후 합계잔액시산표를 엑셀 원본으로 제출해 주십시오.' },
  { title: '분개장 전체(회계연도 전 기간)', category: '일반', description: '회계 시스템에서 추출한 분개장 원본(가공 전)을 제출해 주십시오.' },
  { title: '금융기관 거래처 목록(계좌·차입·보증)', category: '현금', description: '금융거래조회서 발송 대상 확정을 위해 전체 금융기관 목록을 제출해 주십시오.' },
  { title: '매출채권·매입채무 거래처별 잔액명세', category: '매출채권', description: '채권채무조회서 표본 추출을 위한 거래처별 잔액명세서를 제출해 주십시오.' },
  { title: '기말 재고자산 실사표 및 평가 자료', category: '재고', description: '재고실사 결과표와 저가법 평가 근거 자료를 제출해 주십시오.' },
  { title: '유형자산 증감 명세 및 감가상각 계산서', category: '유형자산', description: '당기 취득·처분 증빙과 감가상각 계산 내역을 제출해 주십시오.' },
  { title: '특수관계자 현황 및 거래 명세', category: '공시', description: '특수관계자 목록과 당기 거래·채권채무 잔액을 제출해 주십시오.' },
  { title: '경영진 확인서(서명본)', category: '일반', description: '감사보고서일자 기준 경영진 확인서 서명본을 제출해 주십시오.' },
]

export function RequestsPage() {
  const { id } = useParams()
  const engagement = useEngagement(id)
  const requests = useRequests(id)
  const users = useUsers()
  const today = useToday()

  const [status, setStatus] = useState<'' | RequestStatus>('')
  const [category, setCategory] = useState('')
  const [q, setQ] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [templateOpen, setTemplateOpen] = useState(false)
  const [analytics, setAnalytics] = useState(false)

  const categories = useMemo(() => Array.from(new Set(requests.map((r) => r.category))).sort(), [requests])
  const counts = useMemo(() => {
    const c = Object.fromEntries(STATUSES.map((s) => [s, 0])) as Record<RequestStatus, number>
    requests.forEach((r) => c[r.status]++)
    return c
  }, [requests])

  const filtered = requests.filter(
    (r) =>
      (!status || r.status === status) &&
      (!category || r.category === category) &&
      (!q || `${r.code} ${r.title} ${r.description}`.toLowerCase().includes(q.toLowerCase())),
  )
  const selected = requests.find((r) => r.id === selectedId)
  const userById = (uid?: string) => users.find((u) => u.id === uid)

  if (!engagement) return null

  return (
    <div className="flex h-full min-h-0">
      <div className="min-w-0 flex-1 overflow-auto">
        <div className="flex items-center justify-between px-6 py-5">
          <h1 className="text-[26px] font-normal text-ink">자료 요청 ({requests.length})</h1>
          <div className="flex items-center gap-2">
            <Button variant={analytics ? 'primary' : 'secondary'} onClick={() => setAnalytics((v) => !v)}>
              현황 분석
            </Button>
            <Button variant="secondary" onClick={() => setTemplateOpen(true)}>
              한공회 서식으로 일괄 생성 <KrTag />
            </Button>
            <Button variant="primary" icon={<Plus size={16} />} onClick={() => setCreateOpen(true)}>
              요청
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 px-6">
          {STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => setStatus(status === s ? '' : s)}
              className={cx(
                'inline-flex h-8 items-center gap-2 rounded-full border px-3 text-[13px]',
                status === s ? 'border-brand bg-brand-soft text-ink' : 'border-line bg-white text-ink-2 hover:bg-canvas',
              )}
            >
              <span className="h-2 w-2 rounded-full" style={{ background: requestStatusMap[s].color }} />
              {requestStatusMap[s].label}
              <span className="font-semibold">{counts[s]}</span>
            </button>
          ))}
        </div>

        {analytics && (
          <div className="mx-6 mt-4 rounded-lg bg-canvas p-4">
            <RequestAnalytics requests={requests} today={today} />
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3 px-6 pt-5 pb-2">
          <Select label="상태" value={status} onChange={(e) => setStatus(e.target.value as RequestStatus | '')} className="w-40">
            <option value="">전체</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {requestStatusMap[s].label}
              </option>
            ))}
          </Select>
          <Select label="분류" value={category} onChange={(e) => setCategory(e.target.value)} className="w-40">
            <option value="">전체</option>
            {categories.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Select>
          <div className="relative w-72">
            <Search size={15} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-faint" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="코드·요청 자료 검색" className="h-10 pl-9" />
          </div>
          <span className="ml-auto text-xs text-muted">{filtered.length}건 표시</span>
        </div>

        <div className="px-6 pb-4">
          <DemoNote>
            고객사 담당자는{' '}
            <Link to={`/portal/${engagement.id}`} className="text-brand hover:underline">
              고객 포털
            </Link>
            에서 이 요청 목록을 보고 파일을 올리거나 댓글을 남깁니다. 제출하면 상태가 '제출됨'으로 바뀝니다.
          </DemoNote>
        </div>

        <div className="px-6 pb-10">
          {filtered.length === 0 ? (
            <EmptyState title="조건에 맞는 요청이 없습니다." />
          ) : (
            <table className="w-full">
              <thead>
                <tr>
                  <Th className="w-20">코드</Th>
                  <Th>요청 자료</Th>
                  <Th>분류</Th>
                  <Th>상태</Th>
                  <Th>고객 담당</Th>
                  <Th>감사팀 담당</Th>
                  <Th>기한</Th>
                  <Th className="text-center">첨부</Th>
                  <Th className="text-center">댓글</Th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const overdue = r.status !== 'accepted' && r.dueDate < today
                  return (
                    <tr
                      key={r.id}
                      onClick={() => setSelectedId(r.id)}
                      className={cx('cursor-pointer hover:bg-canvas', selectedId === r.id && 'bg-brand-soft/60')}
                    >
                      <Td className="font-mono text-xs text-muted">{r.code}</Td>
                      <Td className="font-medium text-ink">
                        <span className="flex flex-wrap items-center gap-1.5">
                          {r.status === 'returned' && <span className="font-semibold text-danger">반려 |</span>}
                          {r.title}
                          <TagChips tags={r.tags} size="xs" />
                        </span>
                      </Td>
                      <Td>{r.category}</Td>
                      <Td>
                        <RequestStatusBadge status={r.status} />
                      </Td>
                      <Td>
                        <Avatar user={userById(r.clientAssigneeId)} />
                      </Td>
                      <Td>
                        <Avatar user={userById(r.ownerId)} />
                      </Td>
                      <Td className={cx(overdue && 'font-medium text-danger')}>
                        {date(r.dueDate)}
                        {overdue && <span className="ml-1 text-[11px]">기한 경과</span>}
                      </Td>
                      <Td className="text-center">
                        <span className="inline-flex items-center gap-1 text-muted">
                          <Paperclip size={13} />
                          {r.documentIds.length}
                        </span>
                      </Td>
                      <Td className="text-center">
                        <span className="inline-flex items-center gap-1 text-muted">
                          <MessageSquare size={13} />
                          {r.comments.length}
                        </span>
                      </Td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {selected && <RequestDrawer request={selected} onClose={() => setSelectedId(null)} />}

      <CreateRequestModal open={createOpen} onClose={() => setCreateOpen(false)} engagementId={engagement.id} today={today} />
      <TemplateModal
        open={templateOpen}
        onClose={() => setTemplateOpen(false)}
        engagementId={engagement.id}
        today={today}
        existingTitles={requests.map((r) => r.title)}
      />
    </div>
  )
}

// ---------------------------------------------------------------- 상세 드로어

function RequestDrawer({ request: r, onClose }: { request: AuditRequest; onClose: () => void }) {
  const users = useUsers()
  const docs = useDocuments(r.engagementId)
  const [text, setText] = useState('')
  const [returnMode, setReturnMode] = useState(false)
  const attached = docs.filter((d) => r.documentIds.includes(d.id))
  const userById = (uid?: string) => users.find((u) => u.id === uid)

  const send = async () => {
    if (!text.trim()) return
    await api.commentRequest(r.id, text.trim())
    if (returnMode) {
      await api.setRequestStatus(r.id, 'returned')
      setReturnMode(false)
    }
    setText('')
  }

  return (
    <aside className="flex w-[420px] shrink-0 flex-col border-l border-line bg-white">
      <header className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
        <div className="min-w-0">
          <div className="mb-1 flex items-center gap-2">
            <span className="font-mono text-xs text-muted">{r.code}</span>
            <RequestStatusBadge status={r.status} />
          </div>
          <h2 className="text-[17px] font-medium text-ink">{r.title}</h2>
        </div>
        <button onClick={onClose} className="rounded p-1 text-muted hover:bg-canvas" aria-label="닫기">
          <X size={18} />
        </button>
      </header>

      <div className="min-h-0 flex-1 space-y-6 overflow-auto px-5 py-4">
        <dl className="grid grid-cols-[88px_1fr] gap-y-2 text-[13px]">
          <dt className="text-muted">분류</dt>
          <dd className="text-ink-2">{r.category}</dd>
          <dt className="text-muted">기한</dt>
          <dd className="text-ink-2">{date(r.dueDate)}</dd>
          <dt className="text-muted">고객 담당</dt>
          <dd>
            <Avatar user={userById(r.clientAssigneeId)} withName />
          </dd>
          <dt className="text-muted">감사팀 담당</dt>
          <dd>
            <Avatar user={userById(r.ownerId)} withName />
          </dd>
        </dl>

        <TagEditor request={r} />

        <section>
          <h3 className="mb-1.5 text-[11px] font-semibold tracking-wider text-muted uppercase">설명</h3>
          <p className="text-[13px] leading-relaxed whitespace-pre-wrap text-ink-2">{r.description || '—'}</p>
        </section>

        <section>
          <h3 className="mb-1.5 text-[11px] font-semibold tracking-wider text-muted uppercase">첨부 문서 ({attached.length})</h3>
          {attached.length === 0 ? (
            <p className="text-[13px] text-faint">아직 제출된 파일이 없습니다.</p>
          ) : (
            <ul className="space-y-1.5">
              {attached.map((d) => (
                <li key={d.id} className="flex items-center gap-2 rounded-md border border-line px-3 py-2 text-[13px]">
                  <FileText size={15} className="shrink-0 text-brand" />
                  <span className="min-w-0 flex-1 truncate text-ink-2">{d.name}</span>
                  <span className="text-xs text-faint">{date(d.uploadedAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h3 className="mb-2 text-[11px] font-semibold tracking-wider text-muted uppercase">댓글 ({r.comments.length})</h3>
          <ul className="space-y-3">
            {r.comments.map((c) => {
              const u = userById(c.authorId)
              return (
                <li key={c.id} className="flex gap-2.5">
                  <Avatar user={u} size={26} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-medium text-ink">{u?.name ?? '알 수 없음'}</span>
                      {u?.role === 'client' && <span className="rounded bg-sky-50 px-1.5 text-[10px] text-sky-700">고객</span>}
                      <span className="text-faint">{dateTime(c.at)}</span>
                    </div>
                    <p className="mt-0.5 text-[13px] whitespace-pre-wrap text-ink-2">{c.text}</p>
                  </div>
                </li>
              )
            })}
            {r.comments.length === 0 && <li className="text-[13px] text-faint">댓글이 없습니다.</li>}
          </ul>
        </section>

        <section>
          <h3 className="mb-2 text-[11px] font-semibold tracking-wider text-muted uppercase">이력</h3>
          <RequestHistory request={r} />
        </section>
      </div>

      <footer className="space-y-3 border-t border-line px-5 py-4">
        {returnMode && <p className="text-xs text-danger">반려 사유를 입력하면 고객에게 댓글로 전달되고 상태가 '반려'로 바뀝니다.</p>}
        <Textarea
          rows={2}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={returnMode ? '반려 사유 (필수)' : '댓글 입력 — 고객 포털에도 표시됩니다'}
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button variant={returnMode ? 'danger' : 'secondary'} size="sm" disabled={!text.trim()} onClick={send}>
            {returnMode ? '반려하기' : '댓글 등록'}
          </Button>
          {returnMode && (
            <Button variant="ghost" size="sm" onClick={() => setReturnMode(false)}>
              취소
            </Button>
          )}
          <span className="flex-1" />
          {r.status === 'submitted' && (
            <Button size="sm" onClick={() => api.setRequestStatus(r.id, 'in_review')}>
              검토 시작
            </Button>
          )}
          {r.status !== 'accepted' && r.status !== 'returned' && !returnMode && (
            <Button variant="danger" size="sm" onClick={() => setReturnMode(true)}>
              반려
            </Button>
          )}
          {r.status !== 'accepted' && (
            <Button variant="primary" size="sm" onClick={() => api.setRequestStatus(r.id, 'accepted')}>
              승인
            </Button>
          )}
          {r.status === 'accepted' && (
            <Button size="sm" onClick={() => api.setRequestStatus(r.id, 'in_review')}>
              승인 취소
            </Button>
          )}
        </div>
      </footer>
    </aside>
  )
}

// ---------------------------------------------------------------- 요청 생성

function CreateRequestModal({ open, onClose, engagementId, today }: { open: boolean; onClose: () => void; engagementId: string; today: string }) {
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('일반')
  const [dueDate, setDueDate] = useState(addDays(today, 14))
  const [description, setDescription] = useState('')

  const submit = async () => {
    if (!title.trim()) return
    await api.createRequest({ engagementId, title: title.trim(), category, dueDate, description })
    setTitle('')
    setDescription('')
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="자료 요청 추가"
      footer={
        <>
          <Button onClick={onClose}>취소</Button>
          <Button variant="primary" disabled={!title.trim()} onClick={submit}>
            요청 생성
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="요청 자료">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="예: 매출채권 연령분석표" autoFocus />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="분류">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="h-9 w-full rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-brand"
            >
              {CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Field>
          <Field label="기한">
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </Field>
        </div>
        <Field label="설명">
          <Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="형식·기간·범위 등 고객에게 전달할 안내" />
        </Field>
      </div>
    </Modal>
  )
}

function TemplateModal({
  open,
  onClose,
  engagementId,
  today,
  existingTitles,
}: {
  open: boolean
  onClose: () => void
  engagementId: string
  today: string
  existingTitles: string[]
}) {
  const [checked, setChecked] = useState<Set<number>>(() => new Set(KICPA_TEMPLATE.map((_, i) => i)))
  const [dueDate, setDueDate] = useState(addDays(today, 14))
  const toggle = (i: number) =>
    setChecked((prev) => {
      const n = new Set(prev)
      if (n.has(i)) n.delete(i)
      else n.add(i)
      return n
    })

  const submit = async () => {
    for (const i of [...checked].sort((a, b) => a - b)) {
      const t = KICPA_TEMPLATE[i]
      await api.createRequest({ engagementId, title: t.title, category: t.category, description: t.description, dueDate })
    }
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      width={600}
      title="한공회 서식으로 자료 요청 일괄 생성"
      footer={
        <>
          <Button onClick={onClose}>취소</Button>
          <Button variant="primary" disabled={checked.size === 0} onClick={submit}>
            {checked.size}건 생성
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-[13px] text-muted">외부감사에서 공통으로 요청하는 표준 자료 목록입니다. 필요한 항목만 골라 한 번에 요청하세요.</p>
        <ul className="divide-y divide-line-2 rounded-md border border-line">
          {KICPA_TEMPLATE.map((t, i) => {
            const exists = existingTitles.includes(t.title)
            return (
              <li key={t.title}>
                <label className="flex cursor-pointer items-start gap-3 px-3 py-2.5 hover:bg-canvas">
                  <input type="checkbox" className="mt-1 accent-brand" checked={checked.has(i)} onChange={() => toggle(i)} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 text-[13px] font-medium text-ink">
                      {t.title}
                      {exists && <span className="text-[11px] font-normal text-pending">이미 요청됨</span>}
                    </span>
                    <span className="block text-xs text-muted">{t.description}</span>
                  </span>
                  <span className="shrink-0 rounded bg-canvas px-1.5 py-0.5 text-[11px] text-muted">{t.category}</span>
                </label>
              </li>
            )
          })}
        </ul>
        <div className="w-48">
          <Field label="공통 기한">
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </Field>
        </div>
        <DemoNote>
          실제 서비스에서는 한공회 감사조서 서식 번호와 연결된 요청 템플릿을 법인별로 편집해 재사용합니다.
        </DemoNote>
      </div>
    </Modal>
  )
}
