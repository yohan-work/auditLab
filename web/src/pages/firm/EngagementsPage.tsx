import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, SlidersHorizontal } from 'lucide-react'
import {
  Avatar,
  Button,
  DemoNote,
  Field,
  Input,
  KrTag,
  Modal,
  ProgressBar,
  SegmentBar,
  Select,
  StatusPill,
  Td,
  Th,
  EmptyState,
  requestStatusMap,
} from '@/components/ui'
import { api } from '@/data/api'
import { useClients, useCurrentUser, useEngagements, useInspection, useRequests, useToday, useUser, useUsers, useWorkflow } from '@/data/hooks'
import { scoreFindings, signOffProgress } from '@/domain/rules'
import type { Engagement, EngagementStatus, EngagementType, RequestStatus } from '@/domain/types'
import { cx, date } from '@/lib/format'

type Metric = 'requests' | 'signoff'

const statusDots: { key: EngagementStatus; label: string; color: string }[] = [
  { key: 'pending', label: '대기', color: '#f5a524' },
  { key: 'in_progress', label: '진행 중', color: '#3b82f6' },
  { key: 'complete', label: '완료', color: '#22a35a' },
  { key: 'archived', label: '보관', color: '#9ca3af' },
]

const requestOrder: RequestStatus[] = ['open', 'submitted', 'in_review', 'returned', 'accepted']

export function EngagementsPage() {
  const engagements = useEngagements()
  const clients = useClients()
  const navigate = useNavigate()
  const [showFilters, setShowFilters] = useState(true)
  const [clientId, setClientId] = useState('')
  const [status, setStatus] = useState<EngagementStatus | ''>('')
  const [metric, setMetric] = useState<Metric>('requests')
  const [creating, setCreating] = useState(false)

  const rows = useMemo(
    () => engagements.filter((e) => (!clientId || e.clientId === clientId) && (!status || e.status === status)),
    [engagements, clientId, status],
  )
  const counts = useMemo(() => {
    const m: Record<EngagementStatus, number> = { pending: 0, in_progress: 0, complete: 0, archived: 0 }
    engagements.forEach((e) => m[e.status]++)
    return m
  }, [engagements])

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex items-center justify-between px-6 py-5">
        <h1 className="text-[26px] font-normal text-ink">감사 업무 ({rows.length})</h1>
        <div className="flex items-center gap-5">
          <div className="flex items-center gap-4 text-[13px] text-ink-2">
            {statusDots.map((s) => (
              <button
                key={s.key}
                onClick={() => setStatus(status === s.key ? '' : s.key)}
                className={cx('flex items-center gap-1.5 rounded px-1 py-0.5', status === s.key && 'bg-canvas font-medium')}
              >
                <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
                {s.label} <span className="tabular text-muted">{counts[s.key]}</span>
              </button>
            ))}
          </div>
          <Button
            aria-label="필터"
            onClick={() => setShowFilters((v) => !v)}
            className={cx('w-9 px-0', showFilters && 'bg-canvas')}
            icon={<SlidersHorizontal size={16} />}
          />
          <Button variant="primary" icon={<Plus size={16} />} onClick={() => setCreating(true)}>
            감사 업무
          </Button>
        </div>
      </div>

      <div className="flex flex-1 border-t border-line">
        {showFilters && (
          <aside className="w-[260px] shrink-0 space-y-6 border-r border-line px-5 py-5">
            <div className="space-y-4">
              <p className="text-[11px] font-semibold tracking-wider text-muted">FILTERS</p>
              <Select label="고객사" value={clientId} onChange={(e) => setClientId(e.target.value)}>
                <option value="">전체</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
              <Select label="상태" value={status} onChange={(e) => setStatus(e.target.value as EngagementStatus | '')}>
                <option value="">전체</option>
                {statusDots.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-4">
              <p className="text-[11px] font-semibold tracking-wider text-muted">METRIC</p>
              <Select label="지표" value={metric} onChange={(e) => setMetric(e.target.value as Metric)}>
                <option value="requests">자료 요청</option>
                <option value="signoff">조서 서명</option>
              </Select>
              {metric === 'requests' && (
                <div className="space-y-1.5">
                  {requestOrder.map((s) => (
                    <div key={s} className="flex items-center gap-2 text-xs text-muted">
                      <span className="h-2 w-2 rounded-full" style={{ background: requestStatusMap[s].color }} />
                      {requestStatusMap[s].label}
                    </div>
                  ))}
                </div>
              )}
            </div>
            {(clientId || status) && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setClientId('')
                  setStatus('')
                }}
              >
                필터 초기화
              </Button>
            )}
          </aside>
        )}

        <div className="min-w-0 flex-1 overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <Th>고객사</Th>
                <Th>업무명</Th>
                <Th>상태</Th>
                <Th>시작일</Th>
                <Th>종료일</Th>
                <Th>업무수행이사</Th>
                <Th className="w-[240px]">{metric === 'requests' ? '자료 요청' : '조서 서명'}</Th>
                <Th>
                  <span className="inline-flex items-center gap-1.5">
                    감리 점검 <KrTag />
                  </span>
                </Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => (
                <EngagementRow
                  key={e.id}
                  e={e}
                  clientName={clients.find((c) => c.id === e.clientId)?.name ?? '—'}
                  metric={metric}
                  onOpen={() => navigate(`/engagements/${e.id}`)}
                />
              ))}
            </tbody>
          </table>
          {!rows.length && <EmptyState title="조건에 맞는 감사 업무가 없습니다." />}
        </div>
      </div>

      {creating && <CreateEngagementModal open onClose={() => setCreating(false)} />}
    </div>
  )
}

function EngagementRow({ e, clientName, metric, onOpen }: { e: Engagement; clientName: string; metric: Metric; onOpen: () => void }) {
  const lead = useUser(e.leadId)
  const requests = useRequests(e.id)
  const nodes = useWorkflow(e.id)
  const findings = useInspection(e.id)
  const score = scoreFindings(findings)

  const segments = requestOrder.map((s) => ({
    value: requests.filter((r) => r.status === s).length,
    color: requestStatusMap[s].color,
    label: requestStatusMap[s].label,
  }))
  const sp = signOffProgress(nodes)

  return (
    <tr onClick={onOpen} className="cursor-pointer hover:bg-canvas">
      <Td className="font-medium text-ink">{clientName}</Td>
      <Td>{e.name}</Td>
      <Td>
        <StatusPill status={e.status} />
      </Td>
      <Td className="tabular">{date(e.startDate) || '—'}</Td>
      <Td className="tabular">{date(e.endDate) || '—'}</Td>
      <Td>
        <Avatar user={lead} withName />
      </Td>
      <Td>
        {metric === 'requests' ? (
          <SegmentBar segments={segments} />
        ) : sp.total ? (
          <div className="flex items-center gap-2">
            <ProgressBar value={sp.pct} />
            <span className="tabular w-9 text-right text-xs text-muted">{sp.pct}%</span>
          </div>
        ) : (
          <span className="text-xs text-faint">—</span>
        )}
      </Td>
      <Td>
        {e.status === 'pending' || !findings.length ? (
          <span className="text-xs text-faint">—</span>
        ) : score.fail ? (
          <span className="inline-flex h-6 items-center rounded border border-red-200 bg-red-50 px-2 text-xs font-medium text-red-700">
            지적 예상 {score.fail}
          </span>
        ) : score.warn ? (
          <span className="inline-flex h-6 items-center rounded border border-amber-200 bg-amber-50 px-2 text-xs font-medium text-amber-700">
            주의 {score.warn}
          </span>
        ) : (
          <span className="inline-flex h-6 items-center rounded border border-green-200 bg-green-50 px-2 text-xs font-medium text-green-700">
            충족
          </span>
        )}
      </Td>
    </tr>
  )
}

const types: EngagementType[] = ['외부감사', '반기검토', '내부회계 감사', '내부회계 검토']

function CreateEngagementModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const clients = useClients()
  const users = useUsers().filter((u) => u.role !== 'client')
  const me = useCurrentUser()
  const today = useToday()
  const navigate = useNavigate()
  const year = Number(today.slice(0, 4))

  const [clientId, setClientId] = useState('')
  const [name, setName] = useState('')
  const [type, setType] = useState<EngagementType>('외부감사')
  const [fiscalYear, setFiscalYear] = useState(year)
  const [agmDate, setAgmDate] = useState(`${year + 1}-03-26`)
  const [leadId, setLeadId] = useState(users.find((u) => u.role === 'partner')?.id ?? me.id)
  const [teamIds, setTeamIds] = useState<string[]>([me.id])

  const toggle = (id: string) => setTeamIds((t) => (t.includes(id) ? t.filter((x) => x !== id) : [...t, id]))
  const finalName = name.trim() || `${fiscalYear} ${type}`
  const canSave = !!clientId

  const save = async () => {
    const id = await api.createEngagement({
      clientId,
      name: finalName,
      type,
      fiscalYear,
      leadId,
      teamIds: teamIds.filter((t) => t !== leadId),
      agmDate: agmDate || undefined,
    })
    if (!id) return // 권한 없음 등으로 거부됨(토스트로 안내)
    onClose()
    navigate(`/engagements/${id}`)
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="새 감사 업무"
      footer={
        <>
          <Button onClick={onClose}>취소</Button>
          <Button variant="primary" disabled={!canSave} onClick={save}>
            만들기
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="고객사">
          <select
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            className="h-9 w-full rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-brand"
          >
            <option value="">고객사 선택</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="업무 유형">
            <select
              value={type}
              onChange={(e) => setType(e.target.value as EngagementType)}
              className="h-9 w-full rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-brand"
            >
              {types.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </Field>
          <Field label="회계연도">
            <Input type="number" value={fiscalYear} onChange={(e) => setFiscalYear(Number(e.target.value))} />
          </Field>
        </div>
        <Field label="업무명">
          <Input value={name} placeholder={`${fiscalYear} ${type}`} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="정기총회일" hint="법정 기한(재무제표 제출 6주 전, 감사보고서 1주 전)을 이 날짜에서 계산합니다.">
          <Input type="date" value={agmDate} onChange={(e) => setAgmDate(e.target.value)} />
        </Field>
        <Field label="업무수행이사">
          <select
            value={leadId}
            onChange={(e) => setLeadId(e.target.value)}
            className="h-9 w-full rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-brand"
          >
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} · {u.title}
              </option>
            ))}
          </select>
        </Field>
        <div className="space-y-1.5">
          <span className="text-xs font-medium text-ink-2">감사팀</span>
          <div className="grid grid-cols-2 gap-2">
            {users
              .filter((u) => u.id !== leadId)
              .map((u) => (
                <label key={u.id} className="flex cursor-pointer items-center gap-2 rounded-md border border-line px-3 py-2 text-sm">
                  <input type="checkbox" checked={teamIds.includes(u.id)} onChange={() => toggle(u.id)} />
                  <Avatar user={u} size={20} />
                  <span className="text-ink-2">{u.name}</span>
                  <span className="ml-auto text-xs text-muted">{u.title}</span>
                </label>
              ))}
          </div>
          <p className="flex items-center gap-1.5 text-xs text-muted">
            <KrTag /> 감사반은 업무수행이사 포함 3인 이상 공동감사가 필요합니다. 현재 {new Set([leadId, ...teamIds]).size}명.
          </p>
        </div>
        <DemoNote>실제 버전에서는 고객사 수임 절차(독립성·수임 검토 양식)와 표준 조서 템플릿이 함께 생성됩니다.</DemoNote>
      </div>
    </Modal>
  )
}
