import { useEffect, type ReactNode, type ButtonHTMLAttributes, type InputHTMLAttributes, type TextareaHTMLAttributes, type SelectHTMLAttributes } from 'react'
import { X } from 'lucide-react'
import { cx } from '@/lib/format'
import type { EngagementStatus, RequestStatus, User, CheckLevel } from '@/domain/types'

// ---------------------------------------------------------------- 버튼·입력

type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'danger'

export function Button({
  variant = 'secondary',
  size = 'md',
  icon,
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: 'sm' | 'md'; icon?: ReactNode }) {
  return (
    <button
      {...rest}
      className={cx(
        'inline-flex items-center justify-center gap-1.5 rounded-md font-medium whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        size === 'sm' ? 'h-7 px-2.5 text-xs' : 'h-9 px-3.5 text-sm',
        variant === 'primary' && 'bg-brand text-white hover:bg-brand-dark',
        variant === 'secondary' && 'border border-line bg-white text-ink-2 hover:bg-canvas',
        variant === 'ghost' && 'text-ink-2 hover:bg-canvas',
        variant === 'danger' && 'border border-red-200 bg-white text-danger hover:bg-danger-soft',
        className,
      )}
    >
      {icon}
      {children}
    </button>
  )
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cx(
        'h-9 w-full rounded-md border border-line bg-white px-3 text-sm outline-none placeholder:text-faint focus:border-brand focus:ring-2 focus:ring-brand/15',
        props.className,
      )}
    />
  )
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={cx(
        'w-full rounded-md border border-line bg-white px-3 py-2 text-sm outline-none placeholder:text-faint focus:border-brand focus:ring-2 focus:ring-brand/15',
        props.className,
      )}
    />
  )
}

export function Select({ label, className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement> & { label?: string }) {
  return (
    <label className={cx('relative block', className)}>
      {label && <span className="absolute -top-2 left-2.5 bg-white px-1 text-[11px] text-muted">{label}</span>}
      <select
        {...rest}
        className="h-10 w-full appearance-none rounded-md border border-line bg-white px-3 pr-8 text-sm text-ink-2 outline-none focus:border-brand"
      >
        {children}
      </select>
      <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-[10px] text-muted">▼</span>
    </label>
  )
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium text-ink-2">{label}</span>
      {children}
      {hint && <span className="block text-xs text-muted">{hint}</span>}
    </label>
  )
}

// ---------------------------------------------------------------- 표시 요소

export function Card({ title, action, children, className }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cx('rounded-lg border border-line bg-white', className)}>
      {(title || action) && (
        <header className="flex items-center justify-between px-5 pt-4 pb-2">
          <h3 className="text-[15px] font-medium text-ink">{title}</h3>
          {action}
        </header>
      )}
      <div className="px-5 pb-5">{children}</div>
    </section>
  )
}

export function Avatar({ user, size = 24, withName }: { user?: User; size?: number; withName?: boolean }) {
  if (!user) return <span className="text-faint">—</span>
  const el = (
    <span
      title={`${user.name} · ${user.title}`}
      className="inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-ink-2"
      style={{ width: size, height: size, background: user.color, fontSize: size * 0.36 }}
    >
      {user.initials}
    </span>
  )
  if (!withName) return el
  return (
    <span className="inline-flex items-center gap-2">
      {el}
      <span className="text-sm text-ink-2">{user.name}</span>
    </span>
  )
}

const engagementStatusMap: Record<EngagementStatus, { label: string; cls: string }> = {
  pending: { label: '대기', cls: 'border-pending text-[#b7791f] bg-pending-soft' },
  in_progress: { label: '진행 중', cls: 'border-[#93c5fd] text-brand-dark bg-progress-soft' },
  complete: { label: '완료', cls: 'border-[#86efac] text-done bg-done-soft' },
  archived: { label: '보관', cls: 'border-line text-muted bg-canvas' },
}

export function StatusPill({ status }: { status: EngagementStatus }) {
  const s = engagementStatusMap[status]
  return <span className={cx('inline-flex h-6 items-center rounded border px-2 text-xs font-medium', s.cls)}>{s.label}</span>
}

export const requestStatusMap: Record<RequestStatus, { label: string; color: string; cls: string }> = {
  open: { label: '요청됨', color: '#6b7280', cls: 'bg-gray-100 text-gray-700' },
  submitted: { label: '제출됨', color: '#3b82f6', cls: 'bg-blue-50 text-blue-700' },
  in_review: { label: '검토 중', color: '#f5a524', cls: 'bg-amber-50 text-amber-700' },
  accepted: { label: '승인', color: '#22a35a', cls: 'bg-green-50 text-green-700' },
  returned: { label: '반려', color: '#dc2626', cls: 'bg-red-50 text-red-700' },
}

export function RequestStatusBadge({ status }: { status: RequestStatus }) {
  const s = requestStatusMap[status]
  return <span className={cx('inline-flex h-6 items-center rounded-full px-2.5 text-xs font-medium', s.cls)}>{s.label}</span>
}

const levelMap: Record<CheckLevel, { label: string; cls: string }> = {
  fail: { label: '지적 예상', cls: 'bg-red-50 text-red-700 border-red-200' },
  warn: { label: '주의', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  pass: { label: '충족', cls: 'bg-green-50 text-green-700 border-green-200' },
}

export function LevelBadge({ level }: { level: CheckLevel }) {
  const s = levelMap[level]
  return <span className={cx('inline-flex h-6 items-center rounded border px-2 text-xs font-medium', s.cls)}>{s.label}</span>
}

/** 상태별 개수를 이어 붙인 막대(엔게이지먼트 목록의 요청 막대) */
export function SegmentBar({ segments, height = 18 }: { segments: { value: number; color: string; label?: string }[]; height?: number }) {
  const shown = segments.filter((s) => s.value > 0)
  const total = shown.reduce((a, s) => a + s.value, 0)
  if (!total) return <span className="text-xs text-faint">—</span>
  return (
    <div className="flex w-full gap-1">
      {shown.map((s, i) => (
        <div
          key={i}
          title={s.label ? `${s.label} ${s.value}` : String(s.value)}
          className="flex items-center justify-center rounded-full text-[11px] font-semibold text-white"
          style={{ flexGrow: s.value, flexBasis: 22, height, background: s.color }}
        >
          {s.value}
        </div>
      ))}
    </div>
  )
}

export function ProgressBar({ value, color = '#3b82f6', track = '#dbeafe', height = 8 }: { value: number; color?: string; track?: string; height?: number }) {
  return (
    <div className="w-full overflow-hidden rounded-full" style={{ background: track, height }}>
      <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, value)}%`, background: color }} />
    </div>
  )
}

export function Donut({ parts, size = 180, stroke = 22, center }: { parts: { value: number; color: string }[]; size?: number; stroke?: number; center?: ReactNode }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const total = parts.reduce((a, p) => a + p.value, 0) || 1
  let offset = 0
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#f0f1f3" strokeWidth={stroke} />
        {parts.map((p, i) => {
          const len = (p.value / total) * c
          const el = (
            <circle
              key={i}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={p.color}
              strokeWidth={stroke}
              strokeDasharray={`${Math.max(0, len - 3)} ${c}`}
              strokeDashoffset={-offset}
              strokeLinecap="round"
            />
          )
          offset += len
          return el
        })}
      </svg>
      {center && <div className="absolute inset-0 flex flex-col items-center justify-center">{center}</div>}
    </div>
  )
}

/** 한국 시장 특화 기능 표시 */
export function KrTag({ className }: { className?: string }) {
  return (
    <span
      title="한국 감사 실무 특화 기능"
      className={cx('inline-flex h-[18px] items-center rounded bg-leaf/15 px-1.5 text-[10px] font-bold tracking-wide text-[#15803d]', className)}
    >
      KR
    </span>
  )
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
      <p className="text-sm font-medium text-ink-2">{title}</p>
      {children && <div className="text-sm text-muted">{children}</div>}
    </div>
  )
}

export function Modal({ open, onClose, title, children, footer, width = 520 }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; width?: number }) {
  useEffect(() => {
    if (!open) return
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 p-4 pt-[10vh]" onClick={onClose}>
      <div className="max-h-[80vh] w-full overflow-auto rounded-lg bg-white shadow-xl" style={{ maxWidth: width }} onClick={(e) => e.stopPropagation()}>
        <header className="flex items-center justify-between border-b border-line px-5 py-3.5">
          <h2 className="text-base font-semibold">{title}</h2>
          <button onClick={onClose} className="rounded p-1 text-muted hover:bg-canvas" aria-label="닫기">
            <X size={18} />
          </button>
        </header>
        <div className="px-5 py-4">{children}</div>
        {footer && <footer className="flex justify-end gap-2 border-t border-line px-5 py-3">{footer}</footer>}
      </div>
    </div>
  )
}

/** 데모 안내: 실제 동작은 아직 없음을 알리는 작은 표시 */
export function DemoNote({ children }: { children: ReactNode }) {
  return <p className="rounded-md bg-canvas px-3 py-2 text-xs text-muted">시연용 · {children}</p>
}

export function Th({ children, className }: { children?: ReactNode; className?: string }) {
  return <th className={cx('h-11 px-4 text-left text-[13px] font-medium whitespace-nowrap text-ink-2', className)}>{children}</th>
}

export function Td({ children, className, colSpan }: { children?: ReactNode; className?: string; colSpan?: number }) {
  return (
    <td colSpan={colSpan} className={cx('h-12 border-t border-line-2 px-4 text-[13px] text-ink-2', className)}>
      {children}
    </td>
  )
}
