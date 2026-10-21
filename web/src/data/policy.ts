// 쓰기 작업 앞뒤에 붙는 공통 규칙: ① 권한 검사 ② 마감(잠금)된 업무 보호 ③ 활동 이력 기록.
// 거부되면 토스트로 이유를 알리고 아무것도 바꾸지 않는다.
import type { AuditApi } from './api'
import { useDb } from './store'
import { toast } from './ui'
import { can, type Action } from '@/domain/permissions'

type Db = ReturnType<typeof useDb.getState>
type Log = { action: string; target: string; engagementId?: string; userId?: string }

interface Rule<A extends unknown[]> {
  /** 이 작업이 속한 감사 업무(잠금 검사용) */
  engagement?: (db: Db, ...args: A) => string | undefined
  permission?: Action | ((db: Db, ...args: A) => Action | undefined)
  /** 권한 외 추가 검사. 거부 사유 문자열을 돌려주면 막는다. */
  check?: (db: Db, ...args: A) => string | undefined
  log?: (db: Db, ...args: A) => Log | undefined
  /** 성공 시 알림 */
  success?: string
}

const nodeOf = (db: Db, id: string) => db.workflow.find((n) => n.id === id)
const nodeLabel = (db: Db, id: string) => {
  const n = nodeOf(db, id)
  return n ? `${n.code} ${n.title}` : id
}
const reqOf = (db: Db, id: string) => db.requests.find((r) => r.id === id)
const roleName = { preparer: '작성 서명', reviewer: '검토 서명', eqr: '심리 서명' } as const
const statusName = { open: '요청됨', submitted: '제출됨', in_review: '검토 시작', accepted: '승인', returned: '반려' } as const

type Rules = { [K in keyof AuditApi]?: Rule<Parameters<AuditApi[K]>> }

const rules: Rules = {
  createEngagement: { permission: 'engagement.manage', log: (_db, i) => ({ action: '감사 업무 생성', target: i.name }) },
  updateEngagement: {
    permission: 'engagement.manage',
    engagement: (_db, id) => id,
    log: (db, id) => ({ action: '감사 업무 설정 변경', target: db.engagements.find((e) => e.id === id)?.name ?? id, engagementId: id }),
  },
  archiveEngagement: {
    permission: 'engagement.archive',
    engagement: (_db, id) => id,
    check: (db, id) => {
      const e = db.engagements.find((x) => x.id === id)
      if (!e?.reportDate) return '감사보고서일을 먼저 기록해야 조서를 취합할 수 있습니다.'
      const pending = db.workflow.filter((n) => n.engagementId === id && n.type !== 'folder' && !n.signOffs.some((s) => s.role === 'reviewer'))
      if (pending.length) return `검토 서명이 없는 조서 ${pending.length}건이 있어 취합할 수 없습니다.`
      if (db.reviewNotes.some((n) => n.engagementId === id && n.status === 'open')) return '미해결 리뷰 노트가 있어 취합할 수 없습니다.'
      return undefined
    },
    log: (_db, id) => ({ action: '조서 최종 취합(잠금)', target: '전체 조서', engagementId: id }),
    success: '조서를 최종 취합하고 잠갔습니다. 이후 수정은 막힙니다.',
  },
  setRequestStatus: {
    engagement: (db, id) => reqOf(db, id)?.engagementId,
    permission: (_db, _id, status) => (status === 'accepted' || status === 'returned' ? 'request.decide' : undefined),
    log: (db, id, status) => ({ action: `자료 요청 ${statusName[status]}`, target: `${reqOf(db, id)?.code} ${reqOf(db, id)?.title}`, engagementId: reqOf(db, id)?.engagementId }),
  },
  setRequestTags: {
    engagement: (db, id) => reqOf(db, id)?.engagementId,
    log: (db, id, tags) => ({ action: '태그 변경', target: `${reqOf(db, id)?.code} → ${tags.join(', ') || '없음'}`, engagementId: reqOf(db, id)?.engagementId }),
  },
  commentRequest: {
    engagement: (db, id) => reqOf(db, id)?.engagementId,
    log: (db, id, _text, authorId) => ({
      action: '댓글',
      target: `${reqOf(db, id)?.code} ${reqOf(db, id)?.title}`,
      engagementId: reqOf(db, id)?.engagementId,
      ...(authorId ? { userId: authorId } : {}),
    }),
  },
  uploadToRequest: {
    engagement: (db, id) => reqOf(db, id)?.engagementId,
    log: (db, id, file, uploaderId) => ({ action: '자료 제출', target: `${reqOf(db, id)?.code} · ${file}`, engagementId: reqOf(db, id)?.engagementId, userId: uploaderId }),
  },
  signOff: {
    engagement: (db, nodeId) => nodeOf(db, nodeId)?.engagementId,
    permission: (_db, _n, role) => `signoff.${role}` as Action,
    check: (db, nodeId, role) => {
      const n = nodeOf(db, nodeId)
      if (role === 'reviewer' && !n?.signOffs.some((s) => s.role === 'preparer')) return '작성자 서명이 먼저 있어야 검토 서명을 할 수 있습니다.'
      if (role === 'reviewer' && n?.signOffs.some((s) => s.role === 'preparer' && s.userId === db.currentUserId))
        return '본인이 작성한 조서는 본인이 검토 서명할 수 없습니다.'
      if (role === 'eqr') {
        const eqrId = db.engagements.find((e) => e.id === n?.engagementId)?.eqrId
        if (eqrId !== db.currentUserId) return '이 업무에 지정된 심리 회계사만 심리 서명을 할 수 있습니다. (내 계정 → 사용자 전환)'
      }
      return undefined
    },
    log: (db, nodeId, role) => ({ action: roleName[role], target: nodeLabel(db, nodeId), engagementId: nodeOf(db, nodeId)?.engagementId }),
  },
  removeSignOff: {
    engagement: (db, nodeId) => nodeOf(db, nodeId)?.engagementId,
    check: (db, nodeId, role) => {
      const s = nodeOf(db, nodeId)?.signOffs.find((x) => x.role === role)
      const me = db.users.find((u) => u.id === db.currentUserId)
      if (s && s.userId !== db.currentUserId && me?.role !== 'partner') return '다른 사람의 서명은 본인 또는 업무수행이사만 취소할 수 있습니다.'
      return undefined
    },
    log: (db, nodeId, role) => ({ action: `${roleName[role]} 취소`, target: nodeLabel(db, nodeId), engagementId: nodeOf(db, nodeId)?.engagementId }),
  },
  updateConclusion: {
    engagement: (db, nodeId) => nodeOf(db, nodeId)?.engagementId,
    log: (db, nodeId) => ({ action: '결론 수정', target: nodeLabel(db, nodeId), engagementId: nodeOf(db, nodeId)?.engagementId }),
  },
  addEvidence: {
    engagement: (db, nodeId) => nodeOf(db, nodeId)?.engagementId,
    log: (db, nodeId, docId, loc) => ({
      action: '근거 연결',
      target: `${nodeLabel(db, nodeId)} ← ${db.documents.find((d) => d.id === docId)?.name ?? docId} (${loc})`,
      engagementId: nodeOf(db, nodeId)?.engagementId,
    }),
  },
  addReviewNote: {
    engagement: (db, nodeId) => nodeOf(db, nodeId)?.engagementId,
    log: (db, nodeId) => ({ action: '리뷰 노트 작성', target: nodeLabel(db, nodeId), engagementId: nodeOf(db, nodeId)?.engagementId }),
  },
  resolveReviewNote: {
    engagement: (db, id) => db.reviewNotes.find((n) => n.id === id)?.engagementId,
    log: (db, id) => {
      const n = db.reviewNotes.find((x) => x.id === id)
      return { action: '리뷰 노트 해결', target: n ? nodeLabel(db, n.nodeId) : id, engagementId: n?.engagementId }
    },
  },
  uploadDocument: {
    engagement: (_db, engagementId) => engagementId,
    log: (_db, engagementId, name) => ({ action: '문서 업로드', target: name, engagementId }),
  },
  importConfirmations: {
    engagement: (_db, engagementId) => engagementId,
    log: (_db, engagementId, channel) => ({ action: '조회서 회신 가져오기', target: channel === 'kftc' ? '금융결제원' : channel === 'nice' ? 'NICE' : '우편', engagementId }),
  },
  recordAlternativeProcedure: {
    engagement: (db, id) => db.confirmations.find((c) => c.id === id)?.engagementId,
    log: (db, id) => {
      const c = db.confirmations.find((x) => x.id === id)
      return { action: '대체절차 기록', target: c?.counterparty ?? id, engagementId: c?.engagementId }
    },
  },
  addTime: {
    engagement: (_db, i) => i.engagementId,
    log: (db, i) => ({ action: '감사시간 입력', target: `${db.users.find((u) => u.id === i.userId)?.name} ${i.hours}h`, engagementId: i.engagementId }),
  },
  approveTime: {
    permission: 'time.approve',
    engagement: (db, id) => db.timeEntries.find((t) => t.id === id)?.engagementId,
    log: (db, id) => {
      const t = db.timeEntries.find((x) => x.id === id)
      return { action: '감사시간 승인', target: `${db.users.find((u) => u.id === t?.userId)?.name} ${t?.date} ${t?.hours}h`, engagementId: t?.engagementId }
    },
  },
  submitIndependence: { log: (db, userId, year) => ({ action: '독립성 확인서 제출', target: `${db.users.find((u) => u.id === userId)?.name} ${year}` }) },
  updateFormField: { engagement: (db, formId) => db.forms.find((f) => f.id === formId)?.engagementId },
  completeForm: {
    engagement: (db, formId) => db.forms.find((f) => f.id === formId)?.engagementId,
    log: (db, formId) => {
      const f = db.forms.find((x) => x.id === formId)
      return { action: '서식 완료', target: f?.title ?? formId, engagementId: f?.engagementId }
    },
  },
  sendQuestionnaire: {
    log: (db, id) => {
      const q = db.questionnaires.find((x) => x.id === id)
      return { action: '질문서 발송', target: q?.title ?? id, engagementId: q?.engagementId }
    },
  },
}

Object.assign(rules, {
  recordTieoutRun: {
    engagement: (_db: Db, run: { engagementId: string }) => run.engagementId,
    log: (_db: Db, run: { engagementId: string; dataset: string; exceptionCount: number; ms: number }) => ({
      action: '전수대사 실행',
      target: `${run.dataset} · 검토 필요 ${run.exceptionCount}건 · ${run.ms}ms`,
      engagementId: run.engagementId,
    }),
  },
  requestFromException: {
    engagement: (_db: Db, engagementId: string) => engagementId,
    log: (_db: Db, engagementId: string, exNo: string) => ({ action: '전수대사 예외 → 회사 확인 요청', target: exNo, engagementId }),
  },
  concludeException: {
    engagement: (_db: Db, engagementId: string) => engagementId,
    log: (_db: Db, engagementId: string, exNo: string) => ({ action: '전수대사 예외 판단 기록', target: exNo, engagementId }),
  },
  linkTieoutToWorkpaper: {
    engagement: (_db: Db, engagementId: string) => engagementId,
    log: (_db: Db, engagementId: string, file: string) => ({ action: '전수대사 결과 조서 연결', target: `${file} → E-61·E-22·E-21`, engagementId }),
    success: '전수대사 결과를 매출(E-61)·Cut-off(E-22)·채권 조회(E-21) 조서의 근거로 연결했습니다.',
  },
} satisfies Rules)

export function withPolicy(inner: AuditApi): AuditApi {
  const out = { ...inner } as Record<string, unknown>
  for (const name of Object.keys(rules) as (keyof AuditApi)[]) {
    const rule = rules[name] as Rule<unknown[]> | undefined
    if (!rule) continue
    const fn = (inner[name] as (...a: unknown[]) => Promise<unknown>).bind(inner)
    out[name] = async (...args: unknown[]) => {
      const db = useDb.getState()
      const me = db.users.find((u) => u.id === db.currentUserId)
      const engagementId = rule.engagement?.(db, ...args)
      const engagement = db.engagements.find((e) => e.id === engagementId)
      if (engagement?.archivedDate) {
        toast('error', `조서가 최종 취합(${engagement.archivedDate})되어 잠겼습니다. 수정할 수 없습니다.`)
        return undefined
      }
      const action = typeof rule.permission === 'function' ? rule.permission(db, ...args) : rule.permission
      if (action && me && !can(me.role, action)) {
        toast('error', `${me.name}(${me.title})님은 이 작업 권한이 없습니다. 설정 → 구성원·권한에서 확인하세요.`)
        return undefined
      }
      const reason = rule.check?.(db, ...args)
      if (reason) {
        toast('error', reason)
        return undefined
      }
      const log = rule.log?.(db, ...args)
      const result = await fn(...args)
      if (log) await inner.logActivity(log)
      if (rule.success) toast('success', rule.success)
      return result
    }
  }
  return out as unknown as AuditApi
}
