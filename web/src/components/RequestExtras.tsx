import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { api } from '@/data/api'
import { useAccessLog, useUsers } from '@/data/hooks'
import type { AuditRequest } from '@/domain/types'
import { cx } from '@/lib/format'

const tagColors = ['bg-ink text-white', 'border border-green-300 text-green-700', 'border border-blue-300 text-blue-700', 'border border-violet-300 text-violet-700']
export const tagClass = (t: string) => tagColors[[...t].reduce((a, c) => a + c.charCodeAt(0), 0) % tagColors.length]

export function TagChips({ tags, size = 'sm' }: { tags: string[]; size?: 'sm' | 'xs' }) {
  return (
    <span className="inline-flex flex-wrap gap-1">
      {tags.map((t) => (
        <span key={t} className={cx('rounded-full', size === 'xs' ? 'px-1.5 text-[10px] leading-4' : 'px-2 py-0.5 text-[11px]', tagClass(t))}>
          {t}
        </span>
      ))}
    </span>
  )
}

/** 요청 태그 편집 (분류·담당 부서·경영진 확인 필요 등) */
export function TagEditor({ request }: { request: AuditRequest }) {
  const [adding, setAdding] = useState(false)
  const [text, setText] = useState('')
  const save = (tags: string[]) => api.setRequestTags(request.id, tags)
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {request.tags.map((t) => (
        <span key={t} className={cx('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px]', tagClass(t))}>
          {t}
          <button aria-label={`${t} 태그 삭제`} onClick={() => save(request.tags.filter((x) => x !== t))} className="opacity-60 hover:opacity-100">
            <X size={11} />
          </button>
        </span>
      ))}
      {adding ? (
        <input
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={() => setAdding(false)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && text.trim()) {
              save([...new Set([...request.tags, text.trim()])])
              setText('')
              setAdding(false)
            }
          }}
          placeholder="태그 입력 후 Enter"
          className="h-6 w-32 rounded-full border border-line px-2 text-[11px] outline-none focus:border-brand"
        />
      ) : (
        <button onClick={() => setAdding(true)} className="inline-flex items-center gap-0.5 rounded-full border border-dashed border-line px-2 py-0.5 text-[11px] text-muted hover:text-ink-2">
          <Plus size={11} /> 태그
        </button>
      )}
    </div>
  )
}

/** 요청 1건의 처리 이력(활동 기록에서 해당 요청만) */
export function RequestHistory({ request }: { request: AuditRequest }) {
  const users = useUsers()
  const items = useAccessLog().filter((l) => l.engagementId === request.engagementId && l.target.startsWith(request.code))
  const base = [
    { at: request.createdAt, who: request.ownerId, what: '요청 생성' },
    ...(request.submittedAt ? [{ at: request.submittedAt, who: request.clientAssigneeId, what: '최초 제출' }] : []),
  ]
  return (
    <ol className="space-y-2 text-[13px]">
      {[...items.map((l) => ({ at: l.at, who: l.userId, what: l.action })), ...base].map((h, i) => (
        <li key={i} className="flex gap-3">
          <span className="tabular w-[112px] shrink-0 text-xs text-muted">{h.at}</span>
          <span className="text-ink-2">
            <b className="font-medium text-ink">{users.find((u) => u.id === h.who)?.name ?? '—'}</b> · {h.what}
          </span>
        </li>
      ))}
      {request.returnCount > 0 && <li className="text-xs text-danger">반려 {request.returnCount}회</li>}
    </ol>
  )
}
