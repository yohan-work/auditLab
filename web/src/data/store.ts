// 시연용 인메모리 저장소. 화면은 이 파일을 직접 쓰지 않고 api.ts와 hooks.ts를 거친다.
// 실제 백엔드로 바꿀 때는 api.ts의 구현만 HTTP 호출로 교체하면 된다.
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import * as seed from './mock/seed'
import * as settingsSeed from './mock/settings'
import type {
  AccessLogEntry,
  AuditDocument,
  AuditForm,
  AuditRequest,
  Client,
  Confirmation,
  ControlTemplate,
  Engagement,
  Firm,
  FSLine,
  InboxItem,
  IndependenceConfirmation,
  Integration,
  NotificationPref,
  Questionnaire,
  ReviewNote,
  TimeEntry,
  User,
  WorkflowNode,
} from '@/domain/types'

export interface DbState {
  today: string
  currentUserId: string
  firm: Firm
  users: User[]
  clients: Client[]
  engagements: Engagement[]
  requests: AuditRequest[]
  workflow: WorkflowNode[]
  reviewNotes: ReviewNote[]
  documents: AuditDocument[]
  fsLines: FSLine[]
  timeEntries: TimeEntry[]
  confirmations: Confirmation[]
  independence: IndependenceConfirmation[]
  forms: AuditForm[]
  questionnaires: Questionnaire[]
  inbox: InboxItem[]
  controls: ControlTemplate[]
  integrations: Integration[]
  notificationPrefs: NotificationPref[]
  accessLog: AccessLogEntry[]
}

function initialState(): DbState {
  const clone = <T,>(v: T): T => structuredClone(v)
  return {
    today: seed.DEMO_TODAY,
    currentUserId: seed.CURRENT_USER_ID,
    firm: clone(seed.firm),
    users: clone(seed.users),
    clients: clone(seed.clients),
    engagements: clone(seed.engagements),
    requests: clone(seed.requests),
    workflow: clone(seed.workflow),
    reviewNotes: clone(seed.reviewNotes),
    documents: clone(seed.documents),
    fsLines: clone(seed.fsLines),
    timeEntries: clone(seed.timeEntries),
    confirmations: clone(seed.confirmations),
    independence: clone(seed.independence),
    forms: clone(seed.forms),
    questionnaires: clone(seed.questionnaires),
    inbox: clone(seed.inbox),
    controls: clone(seed.controls),
    integrations: clone(settingsSeed.integrations),
    notificationPrefs: clone(settingsSeed.notificationPrefs),
    accessLog: clone(settingsSeed.accessLog),
  }
}

// 클릭으로 바꾼 상태를 브라우저에 저장해 새로고침 후에도 이어서 시연할 수 있게 한다.
// 시드 구조가 바뀌면 version을 올려 예전 저장본을 버린다.
export const useDb = create<DbState>()(
  persist(() => initialState(), {
    name: 'auditlab-demo',
    version: 2,
    storage: createJSONStorage(() => localStorage),
    migrate: () => initialState(),
  }),
)

export const resetDb = () => useDb.setState(initialState(), true)

let counter = 0
export const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${(counter++).toString(36)}`
export const nowIso = () => {
  const t = new Date()
  return `${useDb.getState().today}T${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`
}
