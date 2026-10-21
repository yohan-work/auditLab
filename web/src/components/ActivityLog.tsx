import { History } from 'lucide-react'
import { Avatar, Card, EmptyState } from '@/components/ui'
import { useAccessLog, useUsers } from '@/data/hooks'

/** 누가 언제 무엇을 했는지. 감리에서 "기록이 남아 있는가"를 보여주는 근거가 된다. */
export function ActivityLog({ engagementId, limit = 12 }: { engagementId?: string; limit?: number }) {
  const users = useUsers()
  const log = useAccessLog().filter((l) => !engagementId || l.engagementId === engagementId).slice(0, limit)
  return (
    <Card
      title={
        <span className="flex items-center gap-2">
          <History size={15} className="text-muted" /> 활동 이력
        </span>
      }
      action={<span className="text-xs text-muted">서명·승인·수정이 자동 기록됩니다 (실제 서비스: 변조 방지 저장)</span>}
    >
      {log.length === 0 ? (
        <EmptyState title="아직 기록된 활동이 없습니다." />
      ) : (
        <ol className="divide-y divide-line-2">
          {log.map((l) => {
            const u = users.find((x) => x.id === l.userId)
            return (
              <li key={l.id} className="flex items-center gap-3 py-2.5 text-[13px]">
                <span className="tabular w-[124px] shrink-0 text-xs text-muted">{l.at}</span>
                <Avatar user={u} size={22} />
                <span className="w-16 shrink-0 text-ink-2">{u?.name}</span>
                <span className="shrink-0 font-medium text-ink">{l.action}</span>
                <span className="min-w-0 truncate text-muted">{l.target}</span>
              </li>
            )
          })}
        </ol>
      )}
    </Card>
  )
}
