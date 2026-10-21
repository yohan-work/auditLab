import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CalendarDays,
  Settings,
  HelpCircle,
  UserRound,
  Building2,
  Users,
  Plug,
  ShieldCheck,
  Bell,
  CreditCard,
  BookOpen,
  Keyboard,
  Sparkles,
  MessageCircle,
  LogOut,
  FileSignature,
  Repeat,
  ChevronRight,
} from 'lucide-react'
import { Avatar, KrTag } from '@/components/ui'
import { api } from '@/data/api'
import { useClients, useCurrentUser, useEngagements, useFirm, useIndependence, useToday, useUsers } from '@/data/hooks'
import { helpLinks, releaseNotes, shortcuts } from '@/data/mock/settings'
import { daysBetween, legalDeadlines } from '@/domain/rules'
import { startTour } from '@/data/ui'
import { cx } from '@/lib/format'

// ---------------------------------------------------------------- 드롭다운 틀

type Placement = 'bottom' | 'right' | 'top-right'

function Dropdown({
  trigger,
  label,
  width = 320,
  align = 'right',
  placement = 'bottom',
  dark,
  children,
}: {
  trigger: ReactNode
  label: string
  width?: number
  align?: 'left' | 'right'
  placement?: Placement
  dark?: boolean
  children: (close: () => void) => ReactNode
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])
  return (
    <div ref={ref} className="relative">
      <button
        aria-label={label}
        title={label}
        onClick={() => setOpen((v) => !v)}
        className={cx(
          'flex items-center justify-center rounded-md',
          dark ? 'h-8 w-8 text-white/85 hover:bg-white/10' : 'h-10 w-10 text-ink-2 hover:bg-canvas',
          open && (dark ? 'bg-white/12' : 'bg-canvas'),
        )}
      >
        {trigger}
      </button>
      {open && (
        <div
          className={cx(
            'absolute z-50 overflow-hidden rounded-lg border border-line bg-white text-ink shadow-lg',
            placement === 'bottom' && 'top-full mt-2',
            placement === 'bottom' && (align === 'right' ? 'right-0' : 'left-0'),
            placement === 'right' && 'top-0 left-full ml-2',
            placement === 'top-right' && 'bottom-0 left-full ml-2',
          )}
          style={{ width }}
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  )
}

function MenuItem({ icon, children, hint, onClick, kr }: { icon?: ReactNode; children: ReactNode; hint?: ReactNode; onClick?: () => void; kr?: boolean }) {
  return (
    <button onClick={onClick} className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-[13px] text-ink-2 hover:bg-canvas">
      {icon && <span className="text-muted">{icon}</span>}
      <span className="flex-1">{children}</span>
      {kr && <KrTag />}
      {hint && <span className="text-xs text-faint">{hint}</span>}
    </button>
  )
}

const MenuTitle = ({ children }: { children: ReactNode }) => (
  <div className="px-4 pt-3 pb-1.5 text-[11px] font-semibold tracking-wider text-muted">{children}</div>
)

// ---------------------------------------------------------------- 일정: 다가오는 법정 기한

export function CalendarMenu({ dark, placement }: { dark?: boolean; placement?: Placement }) {
  const engagements = useEngagements()
  const clients = useClients()
  const today = useToday()
  const navigate = useNavigate()
  const items = useMemo(
    () =>
      engagements
        .filter((e) => e.status !== 'archived')
        .flatMap((e) => legalDeadlines(e).filter((d) => !d.doneDate && d.date >= today).map((d) => ({ e, d })))
        .sort((a, b) => a.d.date.localeCompare(b.d.date))
        .slice(0, 7),
    [engagements, today],
  )
  return (
    <Dropdown label="일정" dark={dark} width={360} placement={placement} trigger={<CalendarDays size={18} />}>
      {(close) => (
        <div>
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <span className="text-sm font-semibold">다가오는 법정 기한</span>
            <KrTag />
          </div>
          <ul className="max-h-[360px] overflow-auto py-1">
            {items.map(({ e, d }) => {
              const left = daysBetween(today, d.date)
              return (
                <li key={e.id + d.key}>
                  <button
                    onClick={() => {
                      close()
                      navigate(`/engagements/${e.id}`)
                    }}
                    className="flex w-full items-start gap-3 px-4 py-2.5 text-left hover:bg-canvas"
                  >
                    <span
                      className={cx(
                        'mt-0.5 w-12 shrink-0 rounded px-1.5 py-0.5 text-center text-[11px] font-semibold tabular',
                        left <= 30 ? 'bg-amber-50 text-amber-700' : 'bg-canvas text-ink-2',
                      )}
                    >
                      D-{left}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] text-ink">{d.label}</span>
                      <span className="block truncate text-xs text-muted">
                        {clients.find((c) => c.id === e.clientId)?.name} · {e.name} · {d.date}
                      </span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
          <p className="border-t border-line px-4 py-2.5 text-xs text-muted">정기총회일 기준 자동 계산 (외부감사법 시행령 제8조·제27조)</p>
        </div>
      )}
    </Dropdown>
  )
}

// ---------------------------------------------------------------- 설정

const settingsTabs = [
  { tab: 'general', label: '법인 정보', icon: <Building2 size={15} /> },
  { tab: 'team', label: '구성원·권한', icon: <Users size={15} /> },
  { tab: 'integrations', label: '연동', icon: <Plug size={15} />, kr: true },
  { tab: 'security', label: '보안·데이터 보관', icon: <ShieldCheck size={15} /> },
  { tab: 'notifications', label: '알림', icon: <Bell size={15} /> },
  { tab: 'billing', label: '요금제', icon: <CreditCard size={15} /> },
]

export function SettingsMenu({ dark }: { dark?: boolean }) {
  const navigate = useNavigate()
  const firm = useFirm()
  return (
    <Dropdown label="설정" dark={dark} width={260} trigger={<Settings size={18} />}>
      {(close) => (
        <div className="py-1">
          <MenuTitle>{firm.name} 설정</MenuTitle>
          {settingsTabs.map((t) => (
            <MenuItem
              key={t.tab}
              icon={t.icon}
              kr={t.kr}
              onClick={() => {
                close()
                navigate(`/settings?tab=${t.tab}`)
              }}
            >
              {t.label}
            </MenuItem>
          ))}
          <div className="my-1 border-t border-line" />
          <MenuItem
            icon={<Repeat size={15} />}
            onClick={() => {
              close()
              navigate('/settings?tab=demo')
            }}
          >
            시연 데이터·구조
          </MenuItem>
        </div>
      )}
    </Dropdown>
  )
}

// ---------------------------------------------------------------- 도움말

export function HelpMenu({ dark, placement }: { dark?: boolean; placement?: Placement }) {
  const [view, setView] = useState<'main' | 'shortcuts' | 'news'>('main')
  return (
    <Dropdown label="도움말" dark={dark} width={320} placement={placement} trigger={<HelpCircle size={18} />}>
      {() =>
        view === 'shortcuts' ? (
          <div>
            <button onClick={() => setView('main')} className="px-4 pt-3 text-xs text-brand">← 도움말</button>
            <MenuTitle>단축키 (시연)</MenuTitle>
            <ul className="px-4 pb-3">
              {shortcuts.map(([k, v]) => (
                <li key={k} className="flex justify-between py-1.5 text-[13px]">
                  <span className="text-ink-2">{v}</span>
                  <kbd className="rounded border border-line bg-canvas px-1.5 text-[11px] text-muted">{k}</kbd>
                </li>
              ))}
            </ul>
          </div>
        ) : view === 'news' ? (
          <div>
            <button onClick={() => setView('main')} className="px-4 pt-3 text-xs text-brand">← 도움말</button>
            <MenuTitle>새 기능</MenuTitle>
            <ul className="space-y-3 px-4 pb-4">
              {releaseNotes.map((r) => (
                <li key={r.title}>
                  <p className="text-[13px] font-medium text-ink">{r.title}</p>
                  <p className="text-xs text-muted">{r.desc}</p>
                  <p className="text-[11px] text-faint">{r.date}</p>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="py-1">
            <MenuTitle>도움말 센터</MenuTitle>
            {helpLinks.map((h) => (
              <button key={h.title} className="block w-full px-4 py-2 text-left hover:bg-canvas">
                <span className="flex items-center gap-2 text-[13px] text-ink-2">
                  <BookOpen size={14} className="text-muted" />
                  {h.title}
                </span>
                <span className="block pl-[22px] text-xs text-muted">{h.desc}</span>
              </button>
            ))}
            <div className="my-1 border-t border-line" />
            <MenuItem icon={<Sparkles size={15} />} onClick={startTour}>
              둘러보기 시작 (9단계)
            </MenuItem>
            <MenuItem icon={<Keyboard size={15} />} hint={<ChevronRight size={14} />} onClick={() => setView('shortcuts')}>
              단축키
            </MenuItem>
            <MenuItem icon={<Sparkles size={15} />} hint={<ChevronRight size={14} />} onClick={() => setView('news')}>
              새 기능
            </MenuItem>
            <MenuItem icon={<MessageCircle size={15} />} hint="support@auditlab.example">
              문의하기
            </MenuItem>
            <p className="border-t border-line px-4 py-2 text-[11px] text-faint">auditLab 프로토타입 v0.1 · 시연용 데이터</p>
          </div>
        )
      }
    </Dropdown>
  )
}

// ---------------------------------------------------------------- 내 계정

export function UserMenu({ dark, placement = 'bottom' }: { dark?: boolean; placement?: Placement }) {
  const me = useCurrentUser()
  const users = useUsers().filter((u) => u.role !== 'client')
  const independence = useIndependence()
  const today = useToday()
  const navigate = useNavigate()
  const year = Number(today.slice(0, 4))
  const signed = independence.some((c) => c.userId === me.id && c.year === year && c.signed)
  return (
    <Dropdown
      label="내 계정"
      dark={dark}
      width={300}
      placement={placement}
      trigger={dark ? <UserRound size={18} /> : <Avatar user={me} size={30} />}
    >
      {(close) => (
        <div>
          <div className="flex items-center gap-3 border-b border-line px-4 py-3.5">
            <Avatar user={me} size={38} />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-ink">{me.name}</p>
              <p className="text-xs text-muted">{me.title}</p>
              <p className="truncate text-xs text-faint">{me.email}</p>
            </div>
          </div>
          <div className="py-1">
            <MenuItem
              icon={<UserRound size={15} />}
              onClick={() => {
                close()
                navigate('/settings?tab=profile')
              }}
            >
              내 프로필
            </MenuItem>
            <MenuItem
              icon={<FileSignature size={15} />}
              kr
              hint={<span className={signed ? 'text-done' : 'text-danger'}>{signed ? '제출함' : '미제출'}</span>}
              onClick={() => {
                close()
                navigate('/quality')
              }}
            >
              {year} 독립성 확인서
            </MenuItem>
            <MenuItem
              icon={<Bell size={15} />}
              onClick={() => {
                close()
                navigate('/settings?tab=notifications')
              }}
            >
              알림 설정
            </MenuItem>
          </div>
          <div className="border-t border-line">
            <MenuTitle>사용자 전환 (시연)</MenuTitle>
            <div className="pb-1">
              {users.map((u) => (
                <button
                  key={u.id}
                  onClick={() => {
                    api.switchUser(u.id)
                    close()
                  }}
                  className={cx('flex w-full items-center gap-2.5 px-4 py-1.5 text-left hover:bg-canvas', u.id === me.id && 'bg-brand-soft/60')}
                >
                  <Avatar user={u} size={22} />
                  <span className="flex-1 text-[13px] text-ink-2">{u.name}</span>
                  <span className="text-xs text-muted">{u.title}</span>
                </button>
              ))}
            </div>
            <p className="px-4 pb-2 text-[11px] text-faint">심리 회계사로 전환하면 심리 서명을 직접 해볼 수 있습니다.</p>
          </div>
          <div className="border-t border-line py-1">
            <MenuItem icon={<LogOut size={15} />} onClick={close}>
              로그아웃 (시연에서는 동작 안 함)
            </MenuItem>
          </div>
        </div>
      )}
    </Dropdown>
  )
}

