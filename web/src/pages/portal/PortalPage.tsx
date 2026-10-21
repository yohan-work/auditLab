import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, FileText, MessageSquare, Paperclip, Plus, Search, Send, Upload, AlertCircle } from 'lucide-react'
import { Logo } from '@/components/Logo'
import { Avatar, Button, DemoNote, EmptyState, Input, KrTag, Textarea } from '@/components/ui'
import { RequestAnalytics } from '@/components/RequestAnalytics'
import { RequestHistory, TagChips, TagEditor } from '@/components/RequestExtras'
import { api } from '@/data/api'
import {
  useAllRequests,
  useClient,
  useClients,
  useDocuments,
  useEngagement,
  useEngagements,
  useFirm,
  useQuestionnaires,
  useRequests,
  useToday,
  useUsers,
} from '@/data/hooks'
import { daysBetween, requestMetrics } from '@/domain/rules'
import type { AuditRequest, Questionnaire, User } from '@/domain/types'
import { cx, date, dateTime } from '@/lib/format'

// 고객 포털: 회사 담당자가 쓰는 화면. 감사인 화면과 같은 데이터를 고객 관점으로 보여준다.

type View = 'requests' | 'dashboard' | 'questionnaires'
type Box = 'received' | 'submitted' | 'accepted'

const boxOf = (r: AuditRequest): Box =>
  r.status === 'accepted' ? 'accepted' : r.status === 'submitted' || r.status === 'in_review' ? 'submitted' : 'received'

export function PortalPage() {
  const { id } = useParams()
  const engagement = useEngagement(id)
  const client = useClient(engagement?.clientId)
  const firm = useFirm()
  const users = useUsers()
  const [view, setView] = useState<View>('requests')

  if (!engagement) return <div className="p-10 text-muted">감사 업무를 찾을 수 없습니다.</div>
  const clientUser = users.find((u) => u.role === 'client' && u.clientId === engagement.clientId)

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <header className="flex h-12 shrink-0 items-center gap-3 bg-[#1f2329] px-5 text-white">
        <Logo size={22} />
        <span className="text-[14px] font-semibold">고객 포털</span>
        <span className="text-white/40">|</span>
        <span className="truncate text-[13px] text-white/85">
          {client?.name} · {engagement.name}
        </span>
        <span className="ml-auto flex items-center gap-4">
          <Link to={`/engagements/${engagement.id}/requests`} className="flex items-center gap-1 text-xs text-white/70 hover:text-white">
            <ArrowLeft size={13} /> 감사인 화면
          </Link>
          {clientUser && (
            <span className="flex items-center gap-2 text-xs">
              <Avatar user={clientUser} size={26} /> {clientUser.name}
            </span>
          )}
        </span>
      </header>
      <nav className="flex h-11 shrink-0 items-center gap-1 border-b border-line px-5">
        {(
          [
            ['requests', '요청 자료'],
            ['dashboard', '요약 대시보드'],
            ['questionnaires', '질문서'],
          ] as const
        ).map(([k, l]) => (
          <button
            key={k}
            onClick={() => setView(k)}
            className={cx('h-11 border-b-2 px-3 text-[13px]', view === k ? 'border-ink font-semibold text-ink' : 'border-transparent text-muted hover:text-ink-2')}
          >
            {l}
          </button>
        ))}
        <span className="ml-auto text-xs text-muted">{firm.name}에서 요청한 자료입니다</span>
      </nav>

      {view === 'requests' && <RequestsView engagementId={engagement.id} clientUser={clientUser} />}
      {view === 'dashboard' && <DashboardView clientId={engagement.clientId} clientUser={clientUser} />}
      {view === 'questionnaires' && <QuestionnairesView engagementId={engagement.id} />}
    </div>
  )
}

// ---------------------------------------------------------------- 요청 자료 (목록 + 상세)

function RequestsView({ engagementId, clientUser }: { engagementId: string; clientUser?: User }) {
  const requests = useRequests(engagementId)
  const today = useToday()
  const [mine, setMine] = useState(true)
  const [box, setBox] = useState<Box>('received')
  const [q, setQ] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const scoped = requests.filter((r) => !mine || r.clientAssigneeId === clientUser?.id)
  const counts = { received: 0, submitted: 0, accepted: 0 }
  scoped.forEach((r) => counts[boxOf(r)]++)
  const list = scoped
    .filter((r) => boxOf(r) === box && (!q || `${r.code} ${r.title}`.includes(q)))
    .sort((a, b) => (a.status === 'returned' ? -1 : 0) - (b.status === 'returned' ? -1 : 0) || a.dueDate.localeCompare(b.dueDate))
  const selected = requests.find((r) => r.id === selectedId) ?? list[0]

  return (
    <div className="flex min-h-0 flex-1">
      <section className="flex min-w-0 flex-1 flex-col border-r border-line">
        <div className="flex items-center gap-4 border-b border-line px-5">
          {(
            [
              [true, '내 요청'],
              [false, '전체 요청'],
            ] as const
          ).map(([v, l]) => (
            <button key={l} onClick={() => setMine(v)} className={cx('h-10 border-b-2 text-[13px]', mine === v ? 'border-ink font-semibold' : 'border-transparent text-muted')}>
              {l}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3 px-5 py-3">
          <div className="relative w-64">
            <Search size={14} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-faint" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="요청 검색" className="pl-8" />
          </div>
          <div className="flex gap-2">
            {(
              [
                ['received', '받은 요청'],
                ['submitted', '제출함'],
                ['accepted', '승인됨'],
              ] as const
            ).map(([k, l]) => (
              <button
                key={k}
                onClick={() => setBox(k)}
                className={cx(
                  'inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[13px]',
                  box === k ? 'bg-[#fde68a] font-semibold text-ink' : 'text-ink-2 hover:bg-canvas',
                )}
              >
                {l}
                <span className={cx('rounded-full border px-1.5 text-[11px]', box === k ? 'border-ink/30' : 'border-line')}>{counts[k]}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-xs text-muted">
                <th className="px-5 py-2 font-medium">번호</th>
                <th className="py-2 font-medium">요청 자료</th>
                <th className="py-2 font-medium">받은 날짜</th>
                <th className="py-2 font-medium">기한</th>
                <th className="py-2" />
                <th className="py-2 pr-5" />
              </tr>
            </thead>
            <tbody>
              {list.map((r) => {
                const left = daysBetween(today, r.dueDate)
                const overdue = left < 0 && r.status !== 'accepted'
                return (
                  <tr
                    key={r.id}
                    onClick={() => setSelectedId(r.id)}
                    className={cx('cursor-pointer border-t border-line-2 text-[13px] hover:bg-canvas', selected?.id === r.id && 'bg-[#f3f4f6]')}
                  >
                    <td className="px-5 py-3 font-mono text-xs text-muted">{r.code}</td>
                    <td className="py-3 pr-3">
                      <span className="font-medium text-ink">
                        {r.status === 'returned' && <b className="text-danger">반려 | </b>}
                        {r.title}
                      </span>
                      <span className="mt-1 block">
                        <TagChips tags={r.tags} size="xs" />
                      </span>
                    </td>
                    <td className="tabular py-3 text-xs text-ink-2">{r.createdAt}</td>
                    <td className="py-3">
                      <span className={cx('tabular border-b-2 pb-0.5 text-xs', overdue ? 'border-danger text-danger' : left <= 7 && r.status !== 'accepted' ? 'border-[#2b9d9a]' : 'border-transparent')}>
                        {r.dueDate}
                      </span>
                    </td>
                    <td className="py-3 text-xs text-muted">
                      <span className="mr-3 inline-flex items-center gap-0.5">
                        <Paperclip size={12} /> {r.documentIds.length}
                      </span>
                      {r.comments.length > 0 && (
                        <span className="inline-flex items-center gap-0.5">
                          <MessageSquare size={12} /> {r.comments.length}
                        </span>
                      )}
                    </td>
                    <td className="pr-5" />
                  </tr>
                )
              })}
            </tbody>
          </table>
          {list.length === 0 && <EmptyState title="해당하는 요청이 없습니다." />}
        </div>
      </section>
      {selected ? <RequestDetail key={selected.id} request={selected} clientUser={clientUser} /> : <div className="w-[460px]" />}
    </div>
  )
}

function RequestDetail({ request: r, clientUser }: { request: AuditRequest; clientUser?: User }) {
  const users = useUsers()
  const documents = useDocuments(r.engagementId)
  const today = useToday()
  const [docTab, setDocTab] = useState<'mine' | 'firm' | 'deleted'>('mine')
  const [bottom, setBottom] = useState<'comments' | 'history'>('comments')
  const [uploading, setUploading] = useState(false)
  const [fileName, setFileName] = useState(`${r.title}.xlsx`)
  const [text, setText] = useState('')
  const mineDocs = documents.filter((d) => r.documentIds.includes(d.id))
  const firmDocs = documents.filter((d) => d.requestId === r.id && d.source === 'firm')
  const left = daysBetween(today, r.dueDate)
  const owner = users.find((u) => u.id === r.ownerId)
  const assignee = users.find((u) => u.id === r.clientAssigneeId)
  const lastReturn = r.status === 'returned' ? r.comments.filter((c) => users.find((u) => u.id === c.authorId)?.role !== 'client').at(-1) : undefined
  const canSubmit = (r.status === 'open' || r.status === 'returned') && mineDocs.length > 0

  return (
    <aside className="flex w-[460px] shrink-0 flex-col overflow-auto">
      <div className="flex items-start justify-between gap-3 px-6 pt-5">
        <TagEditor request={r} />
        <button
          title="감사인에게 제출"
          aria-label="감사인에게 제출"
          disabled={!canSubmit}
          onClick={() => api.setRequestStatus(r.id, 'submitted')}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#fde047] text-ink shadow disabled:opacity-30"
        >
          <Send size={17} />
        </button>
      </div>
      <div className="space-y-5 px-6 py-4">
        <div>
          <h2 className="text-[19px] font-semibold text-ink">{r.title}</h2>
          <p className="mt-1 text-xs text-muted">
            받은 날짜 {r.createdAt} · 기한 {r.dueDate}
            {left < 0 && r.status !== 'accepted' && <b className="ml-1 font-medium text-danger">· {-left}일 경과</b>}
          </p>
        </div>
        <div className="flex gap-8 text-[13px]">
          <span className="flex items-center gap-2">
            <Avatar user={assignee} size={26} />
            <span>
              <span className="block text-xs text-muted">우리 회사 담당</span>
              {assignee?.name ?? '미지정'}
            </span>
          </span>
          <span className="flex items-center gap-2">
            <Avatar user={owner} size={26} />
            <span>
              <span className="block text-xs text-muted">감사인 담당</span>
              {owner?.name}
            </span>
          </span>
        </div>
        {lastReturn && (
          <p className="flex gap-2 rounded-md bg-danger-soft px-3 py-2.5 text-[13px] text-danger">
            <AlertCircle size={15} className="mt-0.5 shrink-0" /> 반려 사유 · {lastReturn.text}
          </p>
        )}
        <section>
          <h3 className="mb-1 text-[13px] font-semibold text-ink">설명</h3>
          <p className="text-[13px] text-ink-2">{r.description || '—'}</p>
        </section>

        <section className="rounded-md border border-line">
          <div className="flex items-center gap-4 border-b border-line px-3">
            {(
              [
                ['mine', '제출 문서', mineDocs.length],
                ['firm', '감사인 공유', firmDocs.length],
                ['deleted', '삭제됨', 0],
              ] as const
            ).map(([k, l, n]) => (
              <button key={k} onClick={() => setDocTab(k)} className={cx('flex h-9 items-center gap-1.5 border-b-2 text-[13px]', docTab === k ? 'border-ink font-semibold' : 'border-transparent text-muted')}>
                {l} <span className={cx('rounded-full px-1.5 text-[11px]', docTab === k ? 'bg-ink text-white' : 'border border-line')}>{n}</span>
              </button>
            ))}
          </div>
          <ul className="bg-canvas">
            {(docTab === 'mine' ? mineDocs : docTab === 'firm' ? firmDocs : []).map((d) => (
              <li key={d.id} className="flex items-center gap-2.5 border-b border-line-2 px-3 py-2.5 text-[13px]">
                <FileText size={16} className="text-brand" />
                <span className="min-w-0 flex-1 truncate">{d.name}</span>
                <span className="text-xs text-faint">{date(d.uploadedAt)}</span>
              </li>
            ))}
            {(docTab === 'mine' ? mineDocs : docTab === 'firm' ? firmDocs : []).length === 0 && <li className="px-3 py-4 text-center text-xs text-faint">문서가 없습니다.</li>}
          </ul>
          <div className="px-3 py-2.5">
            {uploading ? (
              <div className="flex gap-2">
                <Input value={fileName} onChange={(e) => setFileName(e.target.value)} />
                <Button
                  variant="primary"
                  icon={<Upload size={14} />}
                  onClick={async () => {
                    if (clientUser) await api.uploadToRequest(r.id, fileName.trim(), clientUser.id)
                    setUploading(false)
                  }}
                >
                  올리기
                </Button>
              </div>
            ) : (
              <button onClick={() => setUploading(true)} className="flex items-center gap-1 text-[13px] font-medium text-ink-2">
                <Plus size={15} /> 문서 추가
              </button>
            )}
          </div>
        </section>

        <section>
          <div className="mb-3 flex gap-4 border-b border-line">
            {(
              [
                ['comments', '댓글'],
                ['history', '이력'],
              ] as const
            ).map(([k, l]) => (
              <button key={k} onClick={() => setBottom(k)} className={cx('h-9 border-b-2 text-[13px]', bottom === k ? 'border-ink font-semibold' : 'border-transparent text-muted')}>
                {l}
              </button>
            ))}
          </div>
          {bottom === 'history' ? (
            <RequestHistory request={r} />
          ) : (
            <>
              <ul className="mb-3 space-y-3">
                {r.comments.map((c) => {
                  const u = users.find((x) => x.id === c.authorId)
                  return (
                    <li key={c.id} className="flex gap-2.5 text-[13px]">
                      <Avatar user={u} size={24} />
                      <span>
                        <span className="text-xs text-muted">
                          {u?.name} · {dateTime(c.at)}
                        </span>
                        <span className="block text-ink-2">{c.text}</span>
                      </span>
                    </li>
                  )
                })}
              </ul>
              <div className="flex items-start gap-2">
                <Avatar user={clientUser} size={28} />
                <Textarea rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder="댓글 입력" />
                <Button
                  disabled={!text.trim()}
                  onClick={async () => {
                    await api.commentRequest(r.id, text.trim(), clientUser?.id)
                    setText('')
                  }}
                >
                  등록
                </Button>
              </div>
            </>
          )}
        </section>
        <DemoNote>실제 서비스에서는 파일이 국내 리전 저장소에 암호화 저장되고 감사인에게만 공유됩니다(설계 방향).</DemoNote>
      </div>
    </aside>
  )
}

// ---------------------------------------------------------------- 요약 대시보드 (여러 감사 업무)

function DashboardView({ clientId, clientUser }: { clientId: string; clientUser?: User }) {
  const engagements = useEngagements().filter((e) => e.clientId === clientId)
  const all = useAllRequests()
  const today = useToday()
  const clients = useClients()
  const [selected, setSelected] = useState<string[]>(engagements.map((e) => e.id))
  const [mineOnly, setMineOnly] = useState(false)
  const requests = useMemo(
    () => all.filter((r) => selected.includes(r.engagementId) && (!mineOnly || r.clientAssigneeId === clientUser?.id)),
    [all, selected, mineOnly, clientUser],
  )
  const m = requestMetrics(requests, today)

  return (
    <div className="flex min-h-0 flex-1">
      <aside className="w-[300px] shrink-0 border-r border-line px-5 py-5">
        <p className="mb-3 text-[11px] font-semibold tracking-wider text-muted">감사 업무 선택</p>
        <div className="mb-3 flex gap-3 text-xs">
          <button onClick={() => setSelected(engagements.map((e) => e.id))} className="font-medium text-ink">
            전체 선택
          </button>
          <span className="text-faint">|</span>
          <button onClick={() => setSelected([])} className="font-medium text-ink">
            전체 해제
          </button>
        </div>
        <ul className="space-y-4">
          {engagements.map((e) => {
            const em = requestMetrics(all.filter((r) => r.engagementId === e.id), today)
            const on = selected.includes(e.id)
            return (
              <li key={e.id}>
                <label className="flex cursor-pointer items-start gap-2.5">
                  <input type="checkbox" className="mt-1" checked={on} onChange={() => setSelected(on ? selected.filter((x) => x !== e.id) : [...selected, e.id])} />
                  <span className="flex-1">
                    <span className="block text-[13px] text-ink">
                      {clients.find((c) => c.id === clientId)?.name} · {e.name}
                    </span>
                    <span className="mt-1.5 flex items-center gap-2">
                      <span className="h-1.5 flex-1 rounded-full bg-line">
                        <span className="block h-full rounded-full bg-[#facc15]" style={{ width: `${em.pctComplete}%` }} />
                      </span>
                      <span className="text-xs text-muted">{em.pctComplete}%</span>
                    </span>
                  </span>
                </label>
              </li>
            )
          })}
        </ul>
      </aside>
      <main className="min-w-0 flex-1 overflow-auto bg-canvas px-6 py-5">
        <div className="mb-4 flex items-end justify-between">
          <div>
            <h1 className="text-[22px] text-ink">요약 대시보드</h1>
            <p className="text-[13px] text-muted">{m.pctComplete}% 완료 · 감사 업무 {selected.length}건 기준</p>
          </div>
          <label className="flex items-center gap-2 text-[13px] text-ink-2">
            <input type="checkbox" checked={mineOnly} onChange={(e) => setMineOnly(e.target.checked)} /> 내 담당만 보기
          </label>
        </div>
        <RequestAnalytics requests={requests} today={today} />
        <p className="mt-4 flex items-center gap-2 text-xs text-muted">
          <KrTag /> 결산 일정(재무제표 제출: 정기총회 6주 전)에 맞춰 마감 예정 건을 미리 확인하세요.
        </p>
      </main>
    </div>
  )
}

// ---------------------------------------------------------------- 질문서

function QuestionnairesView({ engagementId }: { engagementId: string }) {
  const sent = useQuestionnaires(engagementId).filter((q) => q.status !== 'draft')
  return (
    <main className="mx-auto w-full max-w-[860px] space-y-4 px-6 py-6">
      {sent.length === 0 && <EmptyState title="받은 질문서가 없습니다." />}
      {sent.map((q) => (
        <QuestionnaireCard key={q.id} q={q} />
      ))}
    </main>
  )
}

function QuestionnaireCard({ q }: { q: Questionnaire }) {
  const answered = q.questions.filter((x) => x.answer).length
  return (
    <article className="rounded-lg border border-line bg-white px-5 py-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-[15px] font-medium text-ink">{q.title}</h3>
        <span className={cx('text-xs', answered === q.questions.length ? 'text-done' : 'text-muted')}>
          {answered}/{q.questions.length} 답변
        </span>
      </div>
      <ol className="space-y-4">
        {q.questions.map((x, i) => (
          <AnswerField key={x.id} qid={q.id} index={i} question={x} />
        ))}
      </ol>
    </article>
  )
}

function AnswerField({ qid, index, question }: { qid: string; index: number; question: Questionnaire['questions'][number] }) {
  const [text, setText] = useState(question.answer ?? '')
  const dirty = text.trim() !== (question.answer ?? '')
  return (
    <li>
      <p className="mb-1.5 text-[13px] text-ink">
        Q{index + 1}. {question.text}
      </p>
      <div className="flex items-start gap-2">
        <Textarea rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder="답변을 입력하세요" />
        <Button size="md" variant={dirty ? 'primary' : 'secondary'} disabled={!dirty || !text.trim()} onClick={() => api.answerQuestion(qid, question.id, text.trim())}>
          {question.answer ? '수정' : '저장'}
        </Button>
      </div>
    </li>
  )
}
