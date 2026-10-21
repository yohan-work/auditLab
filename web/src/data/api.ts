// 쓰기 작업의 계약(interface)과 시연용 구현.
// 실제 서비스에서는 같은 interface를 HTTP 클라이언트로 구현해 교체한다(예: httpApi).
import { useDb, newId, nowIso } from './store'
import { withPolicy } from './policy'
import { addDays as addDaysIso } from '@/domain/rules'
import type {
  AuditRequest,
  ConfirmationChannel,
  Firm,
  Integration,
  DocumentSource,
  Engagement,
  RequestStatus,
  SignOff,
  TieoutRun,
} from '@/domain/types'

export interface AuditApi {
  setFirmKind(kind: 'firm' | 'audit_team'): Promise<void>
  updateFirm(patch: Partial<Firm>): Promise<void>
  /** 시연용 사용자 전환. 실제 서비스에서는 로그인 세션이 대신한다. */
  switchUser(userId: string): Promise<void>
  setIntegrationStatus(id: string, status: Integration['status']): Promise<void>
  setNotificationPref(id: string, channel: 'inApp' | 'email', value: boolean): Promise<void>
  createEngagement(input: Pick<Engagement, 'clientId' | 'name' | 'type' | 'fiscalYear' | 'leadId' | 'teamIds' | 'agmDate'>): Promise<string>
  updateEngagement(id: string, patch: Partial<Engagement>): Promise<void>
  /** 조서 최종 취합: 이후 해당 업무의 조서·요청·시간 기록은 수정할 수 없다. */
  archiveEngagement(id: string): Promise<void>
  logActivity(entry: { action: string; target: string; engagementId?: string; userId?: string }): Promise<void>

  createRequest(input: Pick<AuditRequest, 'engagementId' | 'title' | 'category' | 'dueDate' | 'description'>): Promise<string>
  setRequestStatus(id: string, status: RequestStatus): Promise<void>
  setRequestTags(id: string, tags: string[]): Promise<void>
  commentRequest(id: string, text: string, authorId?: string): Promise<void>
  uploadToRequest(id: string, fileName: string, uploaderId: string): Promise<void>

  signOff(nodeId: string, role: SignOff['role']): Promise<void>
  removeSignOff(nodeId: string, role: SignOff['role']): Promise<void>
  updateConclusion(nodeId: string, text: string): Promise<void>
  addEvidence(nodeId: string, documentId: string, locator: string): Promise<void>
  addReviewNote(nodeId: string, text: string, assigneeId: string): Promise<void>
  resolveReviewNote(id: string): Promise<void>

  uploadDocument(engagementId: string, name: string, source: DocumentSource, folder: string): Promise<string>

  importConfirmations(engagementId: string, channel: ConfirmationChannel): Promise<number>
  recordAlternativeProcedure(id: string, text: string): Promise<void>

  addTime(input: { engagementId: string; userId: string; date: string; hours: number; memo: string }): Promise<void>
  approveTime(id: string): Promise<void>
  submitIndependence(userId: string, year: number): Promise<void>

  updateFormField(formId: string, fieldId: string, value: string): Promise<void>
  completeForm(formId: string): Promise<void>
  sendQuestionnaire(id: string): Promise<void>
  answerQuestion(id: string, questionId: string, answer: string): Promise<void>

  markInboxRead(id: string): Promise<void>

  /** 전수대사 실행 기록 (계산은 domain/tieout/engine.ts) */
  recordTieoutRun(run: Omit<TieoutRun, 'id' | 'ranAt' | 'ranBy'>): Promise<void>
  /** 검토 필요 항목을 회사 확인 요청으로 보냄 */
  requestFromException(engagementId: string, exNo: string, title: string, description: string): Promise<void>
  concludeException(engagementId: string, exNo: string, judgment: string): Promise<void>
  /** 전수대사 결과를 매출 조서의 근거로 연결 */
  linkTieoutToWorkpaper(engagementId: string, fileName: string): Promise<void>
}

const set = useDb.setState
const get = useDb.getState
const me = () => get().currentUserId
const ok = () => Promise.resolve()

function patchNode(nodeId: string, fn: (n: ReturnType<typeof get>['workflow'][number]) => void) {
  set((s) => ({
    workflow: s.workflow.map((n) => {
      if (n.id !== nodeId) return n
      const c = structuredClone(n)
      fn(c)
      return c
    }),
  }))
}

export const mockApi: AuditApi = {
  setFirmKind(kind) {
    set((s) => ({ firm: { ...s.firm, kind } }))
    return ok()
  },

  updateFirm(patch) {
    set((s) => ({ firm: { ...s.firm, ...patch } }))
    return ok()
  },

  switchUser(userId) {
    set({ currentUserId: userId })
    return ok()
  },

  setIntegrationStatus(id, status) {
    set((s) => ({
      integrations: s.integrations.map((i) =>
        i.id === id ? { ...i, status, lastSync: status === 'connected' ? `${s.today} 09:00` : i.lastSync } : i,
      ),
    }))
    return ok()
  },

  setNotificationPref(id, channel, value) {
    set((s) => ({ notificationPrefs: s.notificationPrefs.map((n) => (n.id === id ? { ...n, [channel]: value } : n)) }))
    return ok()
  },

  createEngagement(input) {
    const id = newId('e')
    set((s) => ({
      engagements: [{ ...input, id, status: 'pending', eqrId: undefined }, ...s.engagements],
    }))
    return Promise.resolve(id)
  },

  updateEngagement(id, patch) {
    set((s) => ({ engagements: s.engagements.map((e) => (e.id === id ? { ...e, ...patch } : e)) }))
    return ok()
  },

  archiveEngagement(id) {
    set((s) => ({
      engagements: s.engagements.map((e) => (e.id === id ? { ...e, archivedDate: s.today, status: 'archived' } : e)),
    }))
    return ok()
  },

  logActivity(entry) {
    set((s) => ({
      accessLog: [{ id: newId('al'), at: nowIso().replace('T', ' '), userId: s.currentUserId, ip: '211.0.0.12', ...entry }, ...s.accessLog],
    }))
    return ok()
  },

  createRequest(input) {
    const id = newId('r')
    set((s) => {
      const n = s.requests.filter((r) => r.engagementId === input.engagementId).length + 1
      const clientId = s.engagements.find((e) => e.id === input.engagementId)?.clientId
      const clientAssigneeId = s.clients.find((c) => c.id === clientId)?.contactUserId
      return {
        requests: [
          ...s.requests,
          {
            ...input,
            id,
            code: `R-${String(n).padStart(2, '0')}`,
            status: 'open',
            ownerId: me(),
            clientAssigneeId,
            documentIds: [],
            comments: [],
            tags: [input.category],
            createdAt: s.today,
            returnCount: 0,
          },
        ],
      }
    })
    return Promise.resolve(id)
  },

  setRequestStatus(id, status) {
    set((s) => ({
      requests: s.requests.map((r) =>
        r.id === id
          ? {
              ...r,
              status,
              submittedAt: status === 'submitted' ? (r.submittedAt ?? s.today) : r.submittedAt,
              returnCount: status === 'returned' ? r.returnCount + 1 : r.returnCount,
            }
          : r,
      ),
    }))
    return ok()
  },

  setRequestTags(id, tags) {
    set((s) => ({ requests: s.requests.map((r) => (r.id === id ? { ...r, tags } : r)) }))
    return ok()
  },

  commentRequest(id, text, authorId) {
    set((s) => ({
      requests: s.requests.map((r) =>
        r.id === id
          ? { ...r, comments: [...r.comments, { id: newId('cm'), authorId: authorId ?? me(), text, at: nowIso() }] }
          : r,
      ),
    }))
    return ok()
  },

  async uploadToRequest(id, fileName, uploaderId) {
    const req = get().requests.find((r) => r.id === id)
    if (!req) return
    const docId = await mockApi.uploadDocument(req.engagementId, fileName, 'client', '회사 제출자료')
    set((s) => ({
      documents: s.documents.map((d) => (d.id === docId ? { ...d, uploadedBy: uploaderId, requestId: id } : d)),
      requests: s.requests.map((r) =>
        r.id === id ? { ...r, status: 'submitted', submittedAt: r.submittedAt ?? s.today, documentIds: [...r.documentIds, docId] } : r,
      ),
    }))
  },

  signOff(nodeId, role) {
    patchNode(nodeId, (n) => {
      n.signOffs = n.signOffs.filter((s) => s.role !== role)
      n.signOffs.push({ userId: me(), role, at: nowIso() })
    })
    return ok()
  },

  removeSignOff(nodeId, role) {
    patchNode(nodeId, (n) => {
      n.signOffs = n.signOffs.filter((s) => s.role !== role)
    })
    return ok()
  },

  updateConclusion(nodeId, text) {
    patchNode(nodeId, (n) => {
      n.conclusion = text
    })
    return ok()
  },

  addEvidence(nodeId, documentId, locator) {
    patchNode(nodeId, (n) => {
      n.evidence.push({ documentId, locator })
    })
    return ok()
  },

  addReviewNote(nodeId, text, assigneeId) {
    const node = get().workflow.find((n) => n.id === nodeId)
    if (!node) return ok()
    set((s) => ({
      reviewNotes: [
        ...s.reviewNotes,
        {
          id: newId('rn'),
          engagementId: node.engagementId,
          nodeId,
          authorId: me(),
          assigneeId,
          text,
          status: 'open',
          createdAt: s.today,
        },
      ],
    }))
    return ok()
  },

  resolveReviewNote(id) {
    set((s) => ({
      reviewNotes: s.reviewNotes.map((n) => (n.id === id ? { ...n, status: 'resolved', resolvedAt: s.today } : n)),
    }))
    return ok()
  },

  uploadDocument(engagementId, name, source, folder) {
    const id = newId('d')
    const ext = (name.split('.').pop() ?? 'pdf') as 'pdf'
    set((s) => ({
      documents: [
        ...s.documents,
        { id, engagementId, name, ext, sizeKb: 120, source, uploadedBy: me(), uploadedAt: s.today, folder },
      ],
    }))
    return Promise.resolve(id)
  },

  importConfirmations(engagementId, channel) {
    // 시연: '발송' 상태 건을 회신 처리한다. 실제로는 결제원 다운로드 파일·NICE 리포트를 파싱한다.
    let n = 0
    set((s) => ({
      confirmations: s.confirmations.map((c) => {
        if (c.engagementId !== engagementId || c.channel !== channel || c.status !== 'sent') return c
        n++
        return { ...c, status: 'replied', confirmedAmount: c.ledgerAmount, repliedAt: s.today }
      }),
    }))
    return Promise.resolve(n)
  },

  recordAlternativeProcedure(id, text) {
    set((s) => ({ confirmations: s.confirmations.map((c) => (c.id === id ? { ...c, alternativeProcedure: text } : c)) }))
    return ok()
  },

  addTime(input) {
    set((s) => ({ timeEntries: [...s.timeEntries, { ...input, id: newId('t') }] }))
    return ok()
  },

  approveTime(id) {
    set((s) => ({
      timeEntries: s.timeEntries.map((t) => (t.id === id ? { ...t, approvedBy: me(), approvedAt: s.today } : t)),
    }))
    return ok()
  },

  submitIndependence(userId, year) {
    set((s) => {
      const exists = s.independence.some((c) => c.userId === userId && c.year === year)
      const rec = { userId, year, signed: true, submittedAt: s.today }
      return {
        independence: exists
          ? s.independence.map((c) => (c.userId === userId && c.year === year ? { ...c, ...rec } : c))
          : [...s.independence, { id: newId('ic'), ...rec }],
      }
    })
    return ok()
  },

  updateFormField(formId, fieldId, value) {
    set((s) => ({
      forms: s.forms.map((f) =>
        f.id === formId
          ? { ...f, updatedAt: s.today, fields: f.fields.map((x) => (x.id === fieldId ? { ...x, value } : x)) }
          : f,
      ),
    }))
    return ok()
  },

  completeForm(formId) {
    set((s) => ({ forms: s.forms.map((f) => (f.id === formId ? { ...f, status: 'completed', updatedAt: s.today } : f)) }))
    return ok()
  },

  sendQuestionnaire(id) {
    set((s) => ({
      questionnaires: s.questionnaires.map((q) => (q.id === id ? { ...q, status: 'sent', sentAt: s.today } : q)),
    }))
    return ok()
  },

  answerQuestion(id, questionId, answer) {
    set((s) => ({
      questionnaires: s.questionnaires.map((q) => {
        if (q.id !== id) return q
        const questions = q.questions.map((x) => (x.id === questionId ? { ...x, answer } : x))
        return { ...q, questions, status: questions.every((x) => x.answer) ? 'answered' : q.status }
      }),
    }))
    return ok()
  },

  recordTieoutRun(run) {
    set((s) => ({ tieoutRuns: [...s.tieoutRuns, { ...run, id: newId('tr'), ranAt: nowIso(), ranBy: s.currentUserId }] }))
    return ok()
  },

  async requestFromException(engagementId, exNo, title, description) {
    const due = addDaysIso(get().today, 7)
    const requestId = await mockApi.createRequest({ engagementId, title, category: '전수대사', dueDate: due, description })
    set((s) => ({
      requests: s.requests.map((r) => (r.id === requestId ? { ...r, tags: ['전수대사', exNo] } : r)),
      tieoutDispositions: [
        ...s.tieoutDispositions.filter((d) => !(d.engagementId === engagementId && d.exNo === exNo)),
        { engagementId, exNo, status: 'requested', requestId, by: s.currentUserId, at: nowIso() },
      ],
    }))
  },

  concludeException(engagementId, exNo, judgment) {
    set((s) => {
      const prev = s.tieoutDispositions.find((d) => d.engagementId === engagementId && d.exNo === exNo)
      return {
        tieoutDispositions: [
          ...s.tieoutDispositions.filter((d) => d !== prev),
          { engagementId, exNo, status: 'concluded', requestId: prev?.requestId, judgment, by: s.currentUserId, at: nowIso() },
        ],
      }
    })
    return ok()
  },

  async linkTieoutToWorkpaper(engagementId, fileName) {
    const docId = await mockApi.uploadDocument(engagementId, fileName, 'tieout', '분석 결과')
    const targets: [string, string][] = [
      ['E-61', 'KT-05 전 건 대사표 · KT-01 검토 필요 목록'],
      ['E-22', '4000P-5 매출 Cut-off (자동 전수)'],
      ['E-21', '4000C-2 거래처별 채권 대사 (증빙 기준 잔액)'],
    ]
    for (const [code, locator] of targets) {
      const node = get().workflow.find((n) => n.engagementId === engagementId && n.code === code)
      if (node && !node.evidence.some((e) => e.documentId === docId)) await mockApi.addEvidence(node.id, docId, locator)
    }
  },

  markInboxRead(id) {
    set((s) => ({ inbox: s.inbox.map((i) => (i.id === id ? { ...i, read: true } : i)) }))
    return ok()
  },
}

// 화면에서 쓰는 단일 진입점. 권한·잠금 검사와 활동 이력은 withPolicy가 감싼다.
// 실제 백엔드 연결 시 mockApi 자리에 httpApi를 넣는다.
export const api: AuditApi = withPolicy(mockApi)
