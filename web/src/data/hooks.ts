// 읽기 전용 조회 훅. 실제 백엔드 연결 시 내부를 서버 조회(예: TanStack Query)로 바꾸고 시그니처는 유지한다.
import { useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useDb } from './store'
import { inspectEngagement } from '@/domain/rules'
import type { InspectionFinding } from '@/domain/types'

export const useToday = () => useDb((s) => s.today)
export const useFirm = () => useDb((s) => s.firm)
export const useUsers = () => useDb((s) => s.users)
export const useClients = () => useDb((s) => s.clients)
export const useEngagements = () => useDb((s) => s.engagements)
export const useControls = () => useDb((s) => s.controls)
export const useIndependence = () => useDb((s) => s.independence)
export const useIntegrations = () => useDb((s) => s.integrations)
export const useNotificationPrefs = () => useDb((s) => s.notificationPrefs)
export const useAccessLog = () => useDb((s) => s.accessLog)

export function useCurrentUser() {
  return useDb(useShallow((s) => s.users.find((u) => u.id === s.currentUserId)!))
}

export function useUser(id?: string) {
  return useDb((s) => s.users.find((u) => u.id === id))
}

export function useClient(id?: string) {
  return useDb((s) => s.clients.find((c) => c.id === id))
}

export function useEngagement(id?: string) {
  return useDb((s) => s.engagements.find((e) => e.id === id))
}

const byEngagement =
  <K extends 'requests' | 'workflow' | 'reviewNotes' | 'documents' | 'fsLines' | 'timeEntries' | 'confirmations' | 'forms' | 'questionnaires'>(
    key: K,
  ) =>
  (engagementId?: string) =>
    useDb(useShallow((s) => (s[key] as { engagementId: string }[]).filter((x) => x.engagementId === engagementId))) as ReturnType<
      typeof useDb.getState
    >[K]

export const useRequests = byEngagement('requests')
export const useWorkflow = byEngagement('workflow')
export const useReviewNotes = byEngagement('reviewNotes')
export const useDocuments = byEngagement('documents')
export const useFsLines = byEngagement('fsLines')
export const useTimeEntries = byEngagement('timeEntries')
export const useConfirmations = byEngagement('confirmations')
export const useForms = byEngagement('forms')
export const useQuestionnaires = byEngagement('questionnaires')

export const useAllRequests = () => useDb((s) => s.requests)

export function useInbox() {
  return useDb(useShallow((s) => s.inbox.filter((i) => i.userId === s.currentUserId)))
}

/** 감사 업무 1건의 감리 모의고사 결과 */
export function useInspection(engagementId?: string): InspectionFinding[] {
  const s = useDb()
  return useMemo(() => {
    const e = s.engagements.find((x) => x.id === engagementId)
    if (!e) return []
    return inspectEngagement({
      firmKind: s.firm.kind,
      asOf: s.today,
      engagement: e,
      users: s.users,
      nodes: s.workflow.filter((n) => n.engagementId === e.id),
      notes: s.reviewNotes.filter((n) => n.engagementId === e.id),
      time: s.timeEntries.filter((t) => t.engagementId === e.id),
      confirmations: s.confirmations.filter((c) => c.engagementId === e.id),
      independence: s.independence,
    })
  }, [s, engagementId])
}

/** 법인 전체 감사 업무의 감리 모의고사 결과 */
export function useFirmInspection(): InspectionFinding[] {
  const s = useDb()
  return useMemo(
    () =>
      s.engagements
        .filter((e) => e.status !== 'pending')
        .flatMap((e) =>
          inspectEngagement({
            firmKind: s.firm.kind,
            asOf: s.today,
            engagement: e,
            users: s.users,
            nodes: s.workflow.filter((n) => n.engagementId === e.id),
            notes: s.reviewNotes.filter((n) => n.engagementId === e.id),
            time: s.timeEntries.filter((t) => t.engagementId === e.id),
            confirmations: s.confirmations.filter((c) => c.engagementId === e.id),
            independence: s.independence,
          }),
        )
        .filter((f, i, all) => f.ruleId !== 'independence' || all.findIndex((x) => x.ruleId === 'independence' && x.detail === f.detail) === i)
        .map((f) => (f.ruleId === 'independence' ? { ...f, engagementId: undefined } : f)),
    [s],
  )
}
