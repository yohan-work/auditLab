import { NavLink, Outlet, Link, useParams, useNavigate } from 'react-router-dom'
import { Inbox, LayoutGrid, Building2, ShieldCheck, BookOpen, CalendarDays, Settings, ChevronDown } from 'lucide-react'
import { Logo } from '@/components/Logo'
import { KrTag, StatusPill } from '@/components/ui'
import { useClient, useEngagement, useEngagements, useClients } from '@/data/hooks'
import { cx } from '@/lib/format'

const rail = [
  { to: '/inbox', icon: Inbox, label: '인박스' },
  { to: '/engagements', icon: LayoutGrid, label: '감사 업무' },
  { to: '/clients', icon: Building2, label: '고객사' },
  { to: '/quality', icon: ShieldCheck, label: '품질관리' },
  { to: '/controls', icon: BookOpen, label: '절차 라이브러리' },
  { to: '/settings', icon: CalendarDays, label: '일정' },
]

export const engagementTabs = [
  { path: '', label: '대시보드' },
  { path: 'insights', label: '인사이트' },
  { path: 'sheets', label: '조서' },
  { path: 'forms', label: '서식' },
  { path: 'questionnaires', label: '질문서' },
  { path: 'requests', label: '자료 요청' },
  { path: 'documents', label: '문서' },
  { path: 'reporting', label: '재무제표' },
  { path: 'confirmations', label: '외부조회', kr: true },
  { path: 'time', label: '감사시간', kr: true },
  { path: 'inspection', label: '감리 모의고사', kr: true },
]

export function EngagementLayout() {
  const { id } = useParams()
  const navigate = useNavigate()
  const e = useEngagement(id)
  const client = useClient(e?.clientId)
  const all = useEngagements()
  const clients = useClients()
  if (!e) return <div className="p-10 text-muted">감사 업무를 찾을 수 없습니다.</div>

  return (
    <div className="flex h-full min-h-screen">
      <aside className="flex w-[60px] shrink-0 flex-col items-center gap-1 border-r border-line bg-white py-3">
        <Link to="/engagements" className="mb-3">
          <Logo size={26} />
        </Link>
        {rail.map(({ to, icon: Icon, label }) => (
          <Link key={to} to={to} title={label} className="flex h-10 w-10 items-center justify-center rounded-md text-ink-2 hover:bg-canvas">
            <Icon size={19} strokeWidth={1.7} />
          </Link>
        ))}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-1 border-b border-line bg-white px-3">
          <nav className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto">
            {engagementTabs.map((t) => (
              <NavLink
                key={t.path}
                end={t.path === ''}
                to={t.path === '' ? `/engagements/${e.id}` : `/engagements/${e.id}/${t.path}`}
                className={({ isActive }) =>
                  cx(
                    'flex h-9 shrink-0 items-center gap-1 rounded-md px-3 text-[14px] whitespace-nowrap',
                    isActive ? 'bg-[#eef0f3] font-medium text-ink' : 'text-ink-2 hover:bg-canvas',
                  )
                }
              >
                {t.label}
                {t.kr && <KrTag />}
              </NavLink>
            ))}
          </nav>
          <div className="flex shrink-0 items-center gap-3 pl-3">
            <Settings size={18} className="text-muted" />
            <StatusPill status={e.status} />
            <span className="text-[15px] font-semibold text-ink">{e.name}</span>
            <label className="relative flex cursor-pointer items-center gap-1 text-[15px] text-muted">
              {client?.name}
              <ChevronDown size={16} />
              <select
                aria-label="감사 업무 전환"
                value={e.id}
                onChange={(ev) => navigate(`/engagements/${ev.target.value}`)}
                className="absolute inset-0 cursor-pointer opacity-0"
              >
                {all.map((x) => (
                  <option key={x.id} value={x.id}>
                    {clients.find((c) => c.id === x.clientId)?.name} · {x.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </header>
        <main className="min-h-0 flex-1 overflow-auto bg-white">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
