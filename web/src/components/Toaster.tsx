import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react'
import { dismissToast, useUi } from '@/data/ui'
import { cx } from '@/lib/format'

export function Toaster() {
  const toasts = useUi((s) => s.toasts)
  return (
    <div className="pointer-events-none fixed top-16 left-1/2 z-[70] flex w-full max-w-[520px] -translate-x-1/2 flex-col gap-2 px-4" aria-live="polite">
      {toasts.map((t) => (
        <div
          key={t.id}
          role={t.kind === 'error' ? 'alert' : 'status'}
          className={cx(
            'pointer-events-auto flex items-start gap-2.5 rounded-lg border bg-white px-4 py-3 text-[13px] shadow-lg',
            t.kind === 'error' && 'border-red-200',
            t.kind === 'success' && 'border-green-200',
            t.kind === 'info' && 'border-line',
          )}
        >
          {t.kind === 'error' && <AlertCircle size={17} className="mt-px shrink-0 text-danger" />}
          {t.kind === 'success' && <CheckCircle2 size={17} className="mt-px shrink-0 text-done" />}
          {t.kind === 'info' && <Info size={17} className="mt-px shrink-0 text-brand" />}
          <span className="flex-1 text-ink-2">{t.text}</span>
          <button onClick={() => dismissToast(t.id)} aria-label="닫기" className="text-faint hover:text-ink-2">
            <X size={15} />
          </button>
        </div>
      ))}
    </div>
  )
}
