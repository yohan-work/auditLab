import { useState } from 'react'
import { Lock, Archive } from 'lucide-react'
import { Button, KrTag, Modal } from '@/components/ui'
import { api } from '@/data/api'
import { useReviewNotes, useToday, useWorkflow } from '@/data/hooks'
import { addDays, daysBetween, hasSignOff, procedures } from '@/domain/rules'
import type { Engagement } from '@/domain/types'
import { cx } from '@/lib/format'

/** 조서 마감 흐름: 감사보고서일 → 60일 카운트다운 → 최종 취합(잠금) */
export function CloseOutControl({ engagement: e }: { engagement: Engagement }) {
  const today = useToday()
  const nodes = useWorkflow(e.id)
  const notes = useReviewNotes(e.id)
  const [open, setOpen] = useState(false)

  if (e.archivedDate) {
    return (
      <span title="최종 취합 이후에는 조서·요청·시간 기록을 수정할 수 없습니다." className="flex items-center gap-1 rounded border border-line bg-canvas px-2 py-1 text-xs text-muted">
        <Lock size={12} /> 잠김 · {e.archivedDate}
      </span>
    )
  }
  if (!e.reportDate) return null

  const due = addDays(e.reportDate, 60)
  const left = daysBetween(today, due)
  const pending = procedures(nodes).filter((n) => !hasSignOff(n, 'reviewer'))
  const openNotes = notes.filter((n) => n.status === 'open')
  const checks: [string, boolean][] = [
    ['감사보고서일 기록', true],
    [`모든 조서 검토 서명 (남은 ${pending.length}건)`, pending.length === 0],
    [`리뷰 노트 해결 (남은 ${openNotes.length}건)`, openNotes.length === 0],
  ]

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={cx(
          'flex items-center gap-1 rounded border px-2 py-1 text-xs font-medium',
          left < 0 ? 'border-red-200 bg-danger-soft text-danger' : left <= 14 ? 'border-amber-200 bg-pending-soft text-amber-700' : 'border-line text-ink-2 hover:bg-canvas',
        )}
      >
        <Archive size={12} /> 조서 취합 {left < 0 ? `D+${-left}` : `D-${left}`}
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="조서 최종 취합"
        footer={
          <>
            <Button onClick={() => setOpen(false)}>취소</Button>
            <Button
              variant="primary"
              icon={<Lock size={14} />}
              onClick={async () => {
                await api.archiveEngagement(e.id)
                setOpen(false)
              }}
            >
              취합하고 잠그기
            </Button>
          </>
        }
      >
        <div className="space-y-4 text-[13px] text-ink-2">
          <p className="flex items-center gap-2">
            감사보고서일 <b className="font-medium text-ink">{e.reportDate}</b> 후 60일 이내인 <b className="font-medium text-ink">{due}</b>까지 조서를 취합해야 합니다. <KrTag />
          </p>
          <ul className="space-y-1.5">
            {checks.map(([label, ok]) => (
              <li key={label} className="flex items-center gap-2">
                <span className={ok ? 'text-done' : 'text-danger'}>{ok ? '✓' : '✕'}</span> {label}
              </li>
            ))}
          </ul>
          <p className="rounded-md bg-canvas px-3 py-2 text-xs text-muted">
            취합하면 업무가 '보관' 상태가 되고 조서·요청·시간 기록이 잠깁니다. 변조 방지 기록과 8년 보존(외부감사법 제19조)은 실제 서비스에서 저장소가 담당합니다(설계 방향).
            업무수행이사만 취합할 수 있습니다.
          </p>
        </div>
      </Modal>
    </>
  )
}
