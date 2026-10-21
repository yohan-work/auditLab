import { useMemo, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { MoreHorizontal, CheckCircle2, AlertTriangle, CalendarClock, MessageSquare, PenLine, StickyNote, ArrowRight } from 'lucide-react'
import { Avatar, Card, Donut, KrTag, ProgressBar, SegmentBar, requestStatusMap } from '@/components/ui'
import {
  useClient,
  useEngagement,
  useInspection,
  useRequests,
  useReviewNotes,
  useTimeEntries,
  useToday,
  useUsers,
  useWorkflow,
} from '@/data/hooks'
import { daysBetween, hoursByUser, legalDeadlines, nodeState, procedures, requestProgress, scoreFindings, signOffProgress } from '@/domain/rules'
import type { Phase } from '@/domain/types'
import { cx, dateTime, num, pct } from '@/lib/format'

const menu = <MoreHorizontal size={18} className="text-faint" />

const phaseMeta: { key: Phase; label: string; color: string }[] = [
  { key: 'planning', label: '계획', color: '#7e22ce' },
  { key: 'execution', label: '실행', color: '#a855f7' },
  { key: 'concluding', label: '완료', color: '#c084fc' },
]

const roleLabel: Record<string, string> = {
  partner: '업무수행이사',
  manager: '책임 회계사',
  senior: '회계사',
  staff: '수습 회계사',
  eqr: '심리(EQR)',
  client: '고객사',
}

function MetricCard({ title, value, sub, children }: { title: string; value: number; sub: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-line bg-white px-5 py-4">
      <div className="flex items-center justify-between">
        <h3 className="text-[15px] font-medium text-ink">{title}</h3>
        {menu}
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="tabular text-[30px] font-light text-ink">{value}%</span>
        <span className="text-xs text-muted">{sub}</span>
      </div>
      <div className="mt-3">{children}</div>
    </section>
  )
}

export function DashboardPage() {
  const { id } = useParams()
  const e = useEngagement(id)
  const client = useClient(e?.clientId)
  const users = useUsers()
  const today = useToday()
  const requests = useRequests(id)
  const nodes = useWorkflow(id)
  const notes = useReviewNotes(id)
  const time = useTimeEntries(id)
  const findings = useInspection(id)

  const req = requestProgress(requests)
  const so = signOffProgress(nodes)
  const resolved = notes.filter((n) => n.status === 'resolved').length
  const notePct = pct(resolved, notes.length)
  const score = scoreFindings(findings)
  const hours = hoursByUser(time)
  const userOf = (uid?: string) => users.find((u) => u.id === uid)

  const byPhase = phaseMeta.map((p) => {
    const ps = procedures(nodes.filter((n) => n.phase === p.key))
    return { ...p, total: ps.length, reviewed: ps.filter((n) => nodeState(n) === 'reviewed').length }
  })
  const reviewedAll = byPhase.reduce((a, p) => a + p.reviewed, 0)
  const totalAll = byPhase.reduce((a, p) => a + p.total, 0)

  const activity = useMemo(() => {
    type Item = { at: string; userId: string; icon: 'comment' | 'sign' | 'note'; text: string; link: string }
    const list: Item[] = []
    const base = `/engagements/${id}`
    for (const r of requests)
      for (const c of r.comments)
        list.push({ at: c.at, userId: c.authorId, icon: 'comment', text: `${r.code} ${r.title}에 댓글: “${c.text}”`, link: `${base}/requests` })
    for (const n of nodes)
      for (const s of n.signOffs)
        list.push({
          at: s.at,
          userId: s.userId,
          icon: 'sign',
          text: `${n.code} ${n.title} — ${s.role === 'preparer' ? '작성자' : s.role === 'reviewer' ? '검토자' : '심리'} 서명`,
          link: `${base}/sheets?node=${n.id}`,
        })
    for (const rn of notes)
      list.push({
        at: rn.resolvedAt ?? rn.createdAt,
        userId: rn.status === 'resolved' ? rn.assigneeId : rn.authorId,
        icon: 'note',
        text: `${rn.status === 'resolved' ? '리뷰 노트 해결' : '리뷰 노트 작성'}: ${rn.text}`,
        link: `${base}/sheets?node=${rn.nodeId}`,
      })
    return list.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 8)
  }, [requests, nodes, notes, id])

  if (!e) return null
  const deadlines = legalDeadlines(e)
  const team = [...new Set([e.leadId, ...e.teamIds, ...(e.eqrId ? [e.eqrId] : [])])]
  const spent = [...hours.values()].reduce((a, b) => a + b, 0)

  return (
    <div className="min-h-full bg-canvas px-6 py-5">
      <div className="mb-5">
        <p className="text-sm text-muted">{client?.name}</p>
        <div className="mt-0.5 flex items-center gap-2.5">
          <h1 className="text-[26px] font-normal text-ink">{e.name}</h1>
          <span className="h-2.5 w-2.5 rounded-full bg-leaf" title="진행 중" />
        </div>
      </div>

      {/* 지표 카드 */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Link to={`/engagements/${id}/requests`} className="block">
          <MetricCard title="자료 요청" value={req.pct} sub={`승인 ${req.accepted} / 전체 ${req.total}`}>
            <SegmentBar
              height={16}
              segments={[
                { value: req.accepted, color: requestStatusMap.accepted.color, label: '승인' },
                { value: req.submitted, color: requestStatusMap.submitted.color, label: '제출·검토 중' },
                { value: req.returned, color: requestStatusMap.returned.color, label: '반려' },
                { value: req.open, color: '#d1d5db', label: '요청됨' },
              ]}
            />
            <div className="mt-2.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted">
              {[
                ['승인', requestStatusMap.accepted.color],
                ['제출·검토', requestStatusMap.submitted.color],
                ['반려', requestStatusMap.returned.color],
                ['요청됨', '#d1d5db'],
              ].map(([l, c]) => (
                <span key={l} className="inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full" style={{ background: c }} />
                  {l}
                </span>
              ))}
            </div>
          </MetricCard>
        </Link>
        <Link to={`/engagements/${id}/sheets`} className="block">
          <MetricCard title="조서 서명" value={so.pct} sub={`작성 ${so.prepared} · 검토 ${so.reviewed} / 절차 ${so.total}`}>
            <ProgressBar value={so.pct} color="#f5a524" track="#fdf0d5" height={10} />
            <p className="mt-2.5 text-[11px] text-muted">작성자·검토자 서명을 각각 절반씩 반영</p>
          </MetricCard>
        </Link>
        <Link to={`/engagements/${id}/sheets`} className="block">
          <MetricCard title="리뷰 노트 / 할 일" value={notePct} sub={`해결 ${resolved} / 전체 ${notes.length}`}>
            <ProgressBar value={notePct} height={10} />
            <p className="mt-2.5 text-[11px] text-muted">미해결 {notes.length - resolved}건</p>
          </MetricCard>
        </Link>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* 진행 현황 */}
        <Card title="진행 현황" action={menu} className="lg:col-span-2">
          <div className="flex flex-col items-center gap-8 py-2 sm:flex-row">
            <Donut
              parts={byPhase.map((p) => ({ value: p.reviewed, color: p.color })).concat([{ value: totalAll - reviewedAll, color: '#f0f1f3' }])}
              center={
                <>
                  <span className="tabular text-[28px] font-light text-ink">{pct(reviewedAll, totalAll)}%</span>
                  <span className="text-xs text-muted">검토 완료</span>
                </>
              }
            />
            <div className="w-full flex-1 space-y-4">
              {byPhase.map((p) => (
                <div key={p.key}>
                  <div className="mb-1.5 flex items-center justify-between text-sm">
                    <span className="inline-flex items-center gap-2 text-ink-2">
                      <span className="h-2.5 w-2.5 rounded-sm" style={{ background: p.color }} />
                      {p.label}
                    </span>
                    <span className="tabular text-muted">
                      {p.reviewed} / {p.total}
                    </span>
                  </div>
                  <ProgressBar value={pct(p.reviewed, p.total)} color={p.color} track="#f3e8ff" height={6} />
                </div>
              ))}
              <p className="text-xs text-muted">단계별 절차 중 검토자 서명까지 끝난 수</p>
            </div>
          </div>
        </Card>

        {/* 감리 모의고사 */}
        <Card
          title={
            <span className="inline-flex items-center gap-2">
              감리 모의고사 <KrTag />
            </span>
          }
          action={menu}
        >
          <div className="grid grid-cols-3 gap-2 text-center">
            {[
              { label: '지적 예상', v: score.fail, cls: 'bg-danger-soft text-danger' },
              { label: '주의', v: score.warn, cls: 'bg-pending-soft text-[#b7791f]' },
              { label: '충족', v: score.pass, cls: 'bg-done-soft text-done' },
            ].map((x) => (
              <div key={x.label} className={cx('rounded-md py-3', x.cls)}>
                <div className="tabular text-2xl font-light">{x.v}</div>
                <div className="text-[11px] font-medium">{x.label}</div>
              </div>
            ))}
          </div>
          <ul className="mt-3 space-y-1.5">
            {findings
              .filter((f) => f.level === 'fail')
              .slice(0, 3)
              .map((f) => (
                <li key={f.ruleId} className="flex items-start gap-1.5 text-xs text-ink-2">
                  <AlertTriangle size={13} className="mt-0.5 shrink-0 text-danger" />
                  <span>
                    {f.title} — <span className="text-muted">{f.detail}</span>
                  </span>
                </li>
              ))}
          </ul>
          <Link to={`/engagements/${id}/inspection`} className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline">
            전체 결과 보기 <ArrowRight size={14} />
          </Link>
        </Card>

        {/* 법정 기한 */}
        <Card
          title={
            <span className="inline-flex items-center gap-2">
              법정 기한 <KrTag />
            </span>
          }
          action={menu}
        >
          {deadlines.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted">정기총회 예정일을 입력하면 기한이 계산됩니다.</p>
          ) : (
            <ul className="divide-y divide-line-2">
              {deadlines.map((d) => {
                const left = daysBetween(today, d.date)
                const done = !!d.doneDate
                const overdue = !done && left < 0
                return (
                  <li key={d.key} className="flex items-start gap-3 py-2.5">
                    {done ? (
                      <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-done" />
                    ) : (
                      <CalendarClock size={18} className={cx('mt-0.5 shrink-0', overdue ? 'text-danger' : 'text-faint')} />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm text-ink">{d.label}</span>
                        <span
                          className={cx(
                            'tabular shrink-0 rounded px-1.5 py-0.5 text-xs font-semibold',
                            done
                              ? 'bg-done-soft text-done'
                              : overdue
                                ? 'bg-danger-soft text-danger'
                                : left <= 30
                                  ? 'bg-pending-soft text-[#b7791f]'
                                  : 'bg-canvas text-ink-2',
                          )}
                        >
                          {done ? '완료' : overdue ? `D+${-left}` : left === 0 ? 'D-day' : `D-${left}`}
                        </span>
                      </div>
                      <div className="text-xs text-muted">
                        {d.date}
                        {done && ` · 완료 ${d.doneDate}`}
                      </div>
                      <div className="text-[11px] text-faint">{d.basis}</div>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>

        {/* 팀 */}
        <Card title="팀" action={<span className="text-xs text-muted">투입 {num(spent)}h{e.standardHours ? ` / 표준 ${num(e.standardHours)}h` : ''}</span>}>
          <ul className="divide-y divide-line-2">
            {team.map((uid) => {
              const u = userOf(uid)
              const h = hours.get(uid) ?? 0
              return (
                <li key={uid} className="flex items-center gap-3 py-2.5">
                  <Avatar user={u} size={30} />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm text-ink">{u?.name}</div>
                    <div className="text-xs text-muted">{uid === e.leadId ? '업무수행이사' : uid === e.eqrId ? '심리(EQR)' : roleLabel[u?.role ?? ''] ?? u?.title}</div>
                  </div>
                  <div className="w-20 text-right">
                    <div className="tabular text-sm text-ink-2">{num(h)}h</div>
                    <ProgressBar value={pct(h, spent)} height={4} color="#9ca3af" track="#f0f1f3" />
                  </div>
                </li>
              )
            })}
          </ul>
        </Card>

        {/* 최근 활동 */}
        <Card title="최근 활동" action={menu}>
          <ul className="space-y-3">
            {activity.map((a, i) => {
              const Icon = a.icon === 'comment' ? MessageSquare : a.icon === 'sign' ? PenLine : StickyNote
              return (
                <li key={i}>
                  <Link to={a.link} className="flex gap-2.5 rounded-md hover:bg-canvas">
                    <Avatar user={userOf(a.userId)} size={26} />
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-[13px] text-ink-2">
                        <span className="font-medium text-ink">{userOf(a.userId)?.name}</span> {a.text}
                      </p>
                      <p className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-faint">
                        <Icon size={11} /> {dateTime(a.at)}
                      </p>
                    </div>
                  </Link>
                </li>
              )
            })}
            {activity.length === 0 && <li className="py-6 text-center text-sm text-muted">활동이 없습니다.</li>}
          </ul>
        </Card>
      </div>
    </div>
  )
}
