import { NavLink, Outlet, Link } from 'react-router-dom'
import { ExternalLink } from 'lucide-react'
import { Logo } from '@/components/Logo'
import { KrTag } from '@/components/ui'
import { CalendarMenu, HelpMenu, SettingsMenu, UserMenu } from '@/components/HeaderMenus'
import { useInbox, useFirm } from '@/data/hooks'
import { PRIMARY_ENGAGEMENT_ID } from '@/data/mock/seed'
import { cx } from '@/lib/format'

const links = [
  { to: '/inbox', label: '인박스' },
  { to: '/engagements', label: '감사 업무' },
  { to: '/controls', label: '절차 라이브러리' },
  { to: '/clients', label: '고객사' },
  { to: '/quality', label: '품질관리', kr: true },
]

export function FirmLayout() {
  const unread = useInbox().filter((i) => !i.read).length
  const firm = useFirm()
  return (
    <div className="flex min-h-full flex-col">
      <nav className="flex h-14 shrink-0 items-center gap-1 bg-nav px-4 text-white">
        <Link to="/engagements" className="mr-4 flex items-center gap-2">
          <Logo />
          <span className="text-[15px] font-semibold tracking-tight">auditLab</span>
        </Link>
        {links.map((l) => (
          <NavLink
            key={l.to}
            to={l.to}
            className={({ isActive }) =>
              cx('flex h-9 items-center gap-1.5 rounded-md px-3 text-[13px] font-medium', isActive ? 'bg-white/12 text-white' : 'text-white/75 hover:text-white')
            }
          >
            {l.label}
            {l.to === '/inbox' && unread > 0 && (
              <span className="rounded-full bg-brand px-1.5 text-[10px] leading-4 font-bold">{unread}</span>
            )}
            {l.kr && <KrTag className="bg-white/15 text-[#86efac]" />}
          </NavLink>
        ))}
        <div className="ml-auto flex items-center gap-1.5 text-white/85">
          <span className="mr-2 text-xs text-white/60">{firm.name}</span>
          <Link
            to={`/portal/${PRIMARY_ENGAGEMENT_ID}`}
            className="mr-2 flex items-center gap-1 rounded-md border border-white/20 px-2.5 py-1 text-xs hover:bg-white/10"
          >
            고객 포털 보기 <ExternalLink size={12} />
          </Link>
          <CalendarMenu dark />
          <SettingsMenu dark />
          <HelpMenu dark />
          <UserMenu dark />
        </div>
      </nav>
      <main className="flex min-h-0 flex-1 flex-col">
        <Outlet />
      </main>
    </div>
  )
}
