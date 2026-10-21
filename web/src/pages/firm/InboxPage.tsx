import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CalendarClock, FileCheck2, FileUp, MessageSquare, PenLine, ShieldAlert, type LucideIcon } from 'lucide-react'
import { Card, EmptyState } from '@/components/ui'
import { api } from '@/data/api'
import { useClients, useCurrentUser, useEngagements, useInbox, useRequests, useReviewNotes, useWorkflow } from '@/data/hooks'
import { nodeState, procedures } from '@/domain/rules'
import type { Engagement, InboxItem } from '@/domain/types'
import { cx, dateTime } from '@/lib/format'

const kindMeta: Record<InboxItem['kind'], { icon: LucideIcon; label: string; cls: string }> = {
  review_note: { icon: PenLine, label: '리뷰 노트', cls: 'bg-amber-50 text-amber-700' },
  request_submitted: { icon: FileUp, label: '자료 제출', cls: 'bg-blue-50 text-blue-700' },
  signoff_needed: { icon: FileCheck2, label: '검토 서명', cls: 'bg-violet-soft/50 text-violet' },
  deadline: { icon: CalendarClock, label: '기한', cls: 'bg-red-50 text-red-700' },
  comment: { icon: MessageSquare, label: '댓글', cls: 'bg-gray-100 text-gray-700' },
  inspection: { icon: ShieldAlert, label: '감리 점검', cls: 'bg-red-50 text-red-700' },
}

export function InboxPage() {
  const items = useInbox()
  const navigate = useNavigate()
  const [tab, setTab] = useState<'all' | 'unread'>('all')
  const unread = items.filter((i) => !i.read).length
  const shown = [...items].filter((i) => tab === 'all' || !i.read).sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  const open = async (i: InboxItem) => {
    await api.markInboxRead(i.id)
    navigate(i.link)
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex items-center justify-between px-6 py-5">
        <h1 className="text-[26px] font-normal text-ink">인박스 ({items.length})</h1>
        {unread > 0 && (
          <button
            className="text-[13px] text-brand hover:underline"
            onClick={() => items.filter((i) => !i.read).forEach((i) => api.markInboxRead(i.id))}
          >
            모두 읽음으로 표시
          </button>
        )}
      </div>

      <div className="flex flex-1 gap-6 border-t border-line bg-canvas px-6 py-5">
        <section className="min-w-0 flex-1 rounded-lg border border-line bg-white">
          <div className="flex gap-5 border-b border-line px-5">
            {(
              [
                ['all', `전체 ${items.length}`],
                ['unread', `읽지 않음 ${unread}`],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                onClick={() => setTab(k)}
                className={cx(
                  '-mb-px h-11 border-b-2 text-[13px] font-medium',
                  tab === k ? 'border-brand text-ink' : 'border-transparent text-muted hover:text-ink-2',
                )}
              >
                {label}
              </button>
            ))}
          </div>
          {shown.length === 0 ? (
            <EmptyState title={tab === 'unread' ? '읽지 않은 알림이 없습니다.' : '알림이 없습니다.'} />
          ) : (
            <ul>
              {shown.map((i) => {
                const m = kindMeta[i.kind]
                const Icon = m.icon
                return (
                  <li key={i.id}>
                    <button
                      onClick={() => open(i)}
                      className="flex w-full items-start gap-3 border-b border-line-2 px-5 py-3.5 text-left last:border-b-0 hover:bg-canvas"
                    >
                      <span className="mt-1.5 flex w-2 shrink-0 justify-center">
                        {!i.read && <span className="h-2 w-2 rounded-full bg-brand" />}
                      </span>
                      <span className={cx('flex h-8 w-8 shrink-0 items-center justify-center rounded-full', m.cls)}>
                        <Icon size={15} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className={cx('block text-[13px]', i.read ? 'text-ink-2' : 'font-medium text-ink')}>{i.text}</span>
                        <span className="mt-0.5 block text-xs text-muted">{m.label}</span>
                      </span>
                      <span className="tabular shrink-0 text-xs text-muted">{dateTime(i.createdAt)}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        <aside className="w-[340px] shrink-0">
          <MyTodos />
        </aside>
      </div>
    </div>
  )
}

function MyTodos() {
  const engagements = useEngagements().filter((e) => e.status === 'in_progress' || e.status === 'pending')
  const clients = useClients()
  return (
    <Card title="내 할 일">
      <p className="mb-3 text-xs text-muted">진행 중인 감사 업무에서 나에게 남은 일</p>
      <div className="space-y-3">
        {engagements.map((e) => (
          <EngagementTodos key={e.id} e={e} clientName={clients.find((c) => c.id === e.clientId)?.name ?? ''} />
        ))}
      </div>
    </Card>
  )
}

function EngagementTodos({ e, clientName }: { e: Engagement; clientName: string }) {
  const me = useCurrentUser()
  const notes = useReviewNotes(e.id).filter((n) => n.status === 'open' && n.assigneeId === me.id)
  const requests = useRequests(e.id).filter((r) => r.status === 'submitted')
  const toReview = procedures(useWorkflow(e.id)).filter((n) => nodeState(n) === 'prepared')
  const involved = e.leadId === me.id || e.teamIds.includes(me.id)
  if (!involved) return null
  const rows = [
    { n: notes.length, label: '나에게 배정된 리뷰 노트', to: `/engagements/${e.id}/sheets`, icon: PenLine },
    { n: requests.length, label: '검토 대기 중인 제출 자료', to: `/engagements/${e.id}/requests`, icon: FileUp },
    { n: toReview.length, label: '검토 서명 대기 조서', to: `/engagements/${e.id}/sheets`, icon: FileCheck2 },
  ].filter((r) => r.n > 0)
  if (!rows.length) return null
  return (
    <div className="rounded-md border border-line-2">
      <Link to={`/engagements/${e.id}`} className="block px-3 pt-2.5 pb-1 text-[13px] font-medium text-ink hover:text-brand">
        {clientName} · {e.name}
      </Link>
      <ul className="pb-1.5">
        {rows.map((r) => (
          <li key={r.label}>
            <Link to={r.to} className="flex items-center gap-2 px-3 py-1.5 text-[13px] text-ink-2 hover:bg-canvas">
              <r.icon size={14} className="text-muted" />
              <span className="flex-1">{r.label}</span>
              <span className="tabular inline-flex min-w-6 justify-center rounded-full bg-brand-soft px-1.5 text-xs font-semibold text-brand-dark">
                {r.n}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

