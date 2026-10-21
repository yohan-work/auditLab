// 순수 함수로 된 업무 규칙. 화면·저장소와 분리되어 있어 실제 백엔드에서도 그대로 재사용한다.
import type {
  AuditRequest,
  Confirmation,
  Engagement,
  FirmKind,
  IndependenceConfirmation,
  InspectionFinding,
  ReviewNote,
  TimeEntry,
  User,
  WorkflowNode,
} from './types'

const DAY = 24 * 60 * 60 * 1000

export function addDays(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00')
  d.setTime(d.getTime() + days * DAY)
  return d.toISOString().slice(0, 10)
}

export function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((new Date(toIso).getTime() - new Date(fromIso).getTime()) / DAY)
}

// ---------------------------------------------------------------- 법정 기한

export interface Deadline {
  key: string
  label: string
  date: string
  basis: string
  doneDate?: string
}

/** 정기총회일을 기준으로 외부감사 법정 기한을 계산한다. */
export function legalDeadlines(e: Engagement): Deadline[] {
  if (!e.agmDate) return []
  const list: Deadline[] = [
    {
      key: 'fs',
      label: '회사 재무제표 제출',
      date: addDays(e.agmDate, -42),
      basis: '외부감사법 시행령 제8조 (정기총회 6주 전)',
      doneDate: e.fsReceivedDate,
    },
    {
      key: 'report',
      label: '감사보고서 제출',
      date: addDays(e.agmDate, -7),
      basis: '외부감사법 시행령 제27조 (정기총회 1주 전)',
      doneDate: e.reportDate,
    },
    { key: 'agm', label: '정기주주총회', date: e.agmDate, basis: '회사 일정' },
  ]
  if (e.reportDate) {
    list.push({
      key: 'archive',
      label: '감사조서 최종 취합',
      date: addDays(e.reportDate, 60),
      basis: '감사보고서일 후 60일 이내 (감리 지적 항목)',
      doneDate: e.archivedDate,
    })
  }
  return list
}

// ---------------------------------------------------------------- 진행률

export function requestProgress(requests: AuditRequest[]) {
  const by = (s: AuditRequest['status']) => requests.filter((r) => r.status === s).length
  const total = requests.length || 1
  return {
    total: requests.length,
    open: by('open'),
    submitted: by('submitted') + by('in_review'),
    accepted: by('accepted'),
    returned: by('returned'),
    pct: Math.round((by('accepted') / total) * 100),
  }
}

export function procedures(nodes: WorkflowNode[]) {
  return nodes.filter((n) => n.type !== 'folder')
}

export function hasSignOff(n: WorkflowNode, role: 'preparer' | 'reviewer' | 'eqr') {
  return n.signOffs.some((s) => s.role === role)
}

export function nodeState(n: WorkflowNode): 'todo' | 'prepared' | 'reviewed' {
  if (hasSignOff(n, 'reviewer')) return 'reviewed'
  if (hasSignOff(n, 'preparer')) return 'prepared'
  return 'todo'
}

export function signOffProgress(nodes: WorkflowNode[]) {
  const p = procedures(nodes)
  const total = p.length || 1
  const prepared = p.filter((n) => hasSignOff(n, 'preparer')).length
  const reviewed = p.filter((n) => hasSignOff(n, 'reviewer')).length
  return {
    total: p.length,
    prepared,
    reviewed,
    pct: Math.round(((prepared + reviewed) / (total * 2)) * 100),
  }
}

/** 폴더 하위 절차의 완료 수 / 전체 수 */
export function folderCount(folderId: string, nodes: WorkflowNode[]): [number, number] {
  const children = nodes.filter((n) => n.parentId === folderId)
  let done = 0
  let total = 0
  for (const c of children) {
    if (c.type === 'folder') {
      const [d, t] = folderCount(c.id, nodes)
      done += d
      total += t
    } else {
      total += 1
      if (nodeState(c) === 'reviewed') done += 1
    }
  }
  return [done, total]
}

export function hoursByUser(entries: TimeEntry[]) {
  const map = new Map<string, number>()
  for (const t of entries) map.set(t.userId, (map.get(t.userId) ?? 0) + t.hours)
  return map
}

// ---------------------------------------------------------------- 감리 모의고사

export interface InspectionInput {
  firmKind: FirmKind
  asOf: string
  engagement: Engagement
  users: User[]
  nodes: WorkflowNode[]
  notes: ReviewNote[]
  time: TimeEntry[]
  confirmations: Confirmation[]
  independence: IndependenceConfirmation[]
}

/**
 * 감사 업무 1건을 금감원·한공회 감리 지적 상위 항목 기준으로 점검한다.
 * 각 규칙은 독립적이므로 규칙을 추가·수정해도 다른 규칙에 영향이 없다.
 */
export function inspectEngagement(input: InspectionInput): InspectionFinding[] {
  const { engagement: e, asOf } = input
  const out: InspectionFinding[] = []
  const base = `/engagements/${e.id}`
  const name = (id?: string) => input.users.find((u) => u.id === id)?.name ?? '미지정'

  // 1. 업무 배분: 감사반은 3인 이상 공동감사 (한공회 감사반 감리 필수 항목)
  if (input.firmKind === 'audit_team') {
    const people = new Set([e.leadId, ...e.teamIds])
    out.push({
      ruleId: 'team-3',
      level: people.size >= 3 ? 'pass' : 'fail',
      category: '업무 배분',
      title: '3인 이상 공동감사',
      detail: people.size >= 3 ? `참여 회계사 ${people.size}명` : `참여 회계사 ${people.size}명 — 3인 미만`,
      basis: '한공회 감사반 감리 필수 점검 항목 ①',
      engagementId: e.id,
      link: `${base}/time`,
    })
    const hours = hoursByUser(input.time)
    const total = [...hours.values()].reduce((a, b) => a + b, 0)
    const maxShare = total ? Math.max(...hours.values()) / total : 0
    out.push({
      ruleId: 'team-balance',
      level: maxShare > 0.7 ? 'warn' : 'pass',
      category: '업무 배분',
      title: '업무의 공정한 배분',
      detail: total ? `1인 최대 비중 ${Math.round(maxShare * 100)}%` : '시간 기록 없음',
      basis: '한공회 감사반 감리 필수 점검 항목 ①',
      engagementId: e.id,
      link: `${base}/time`,
    })
  }

  // 2. 감사시간 기록·승인
  const unapproved = input.time.filter((t) => !t.approvedAt)
  out.push({
    ruleId: 'time-approval',
    level: unapproved.length === 0 ? 'pass' : unapproved.length > 3 ? 'fail' : 'warn',
    category: '감사시간',
    title: '감사시간 입력·승인',
    detail: unapproved.length ? `미승인 시간 기록 ${unapproved.length}건` : '모든 기록 승인됨',
    basis: '금감원 품질관리감리 지적(감사투입시간 입력·승인) · 감사반 필수 항목 ②',
    engagementId: e.id,
    link: `${base}/time`,
  })
  if (e.standardHours) {
    const spent = input.time.reduce((a, t) => a + t.hours, 0)
    const ratio = spent / e.standardHours
    out.push({
      ruleId: 'time-standard',
      level: ratio < 0.6 && e.status !== 'pending' ? 'warn' : 'pass',
      category: '감사시간',
      title: '표준감사시간 대비 투입',
      detail: `투입 ${spent}h / 표준 ${e.standardHours}h (${Math.round(ratio * 100)}%)`,
      basis: '외부감사법 제16조의2 표준감사시간',
      engagementId: e.id,
      link: `${base}/time`,
    })
  }

  // 3. 독립성 확인서 (구성원 연 1회 서면 확인)
  const year = Number(asOf.slice(0, 4))
  const missing = [e.leadId, ...e.teamIds].filter(
    (uid) => !input.independence.some((c) => c.userId === uid && c.year === year && c.signed),
  )
  out.push({
    ruleId: 'independence',
    level: missing.length ? 'fail' : 'pass',
    category: '독립성',
    title: '참여자 독립성 확인서',
    detail: missing.length ? `미제출: ${missing.map(name).join(', ')}` : '전원 제출·서명',
    basis: '개정 품질관리기준서 1 문단 34 (연 1회 서면 확인) · 금감원 감리 지적',
    engagementId: e.id,
    link: `/quality`,
  })

  // 4. 조서 검토 서명
  const procs = procedures(input.nodes)
  const preparedNotReviewed = procs.filter((n) => hasSignOff(n, 'preparer') && !hasSignOff(n, 'reviewer'))
  out.push({
    ruleId: 'review-signoff',
    level: preparedNotReviewed.length === 0 ? 'pass' : e.reportDate ? 'fail' : 'warn',
    category: '조서',
    title: '작성 조서의 검토자 서명',
    detail: preparedNotReviewed.length
      ? `검토 서명 없는 조서 ${preparedNotReviewed.length}건`
      : '작성된 조서 모두 검토됨',
    basis: '감사기준서 220 · 감사반 필수 항목 ③ 상호검토',
    engagementId: e.id,
    link: `${base}/sheets`,
  })
  const noEvidence = procs.filter((n) => hasSignOff(n, 'preparer') && n.evidence.length === 0)
  out.push({
    ruleId: 'evidence',
    level: noEvidence.length ? 'warn' : 'pass',
    category: '조서',
    title: '감사증거 연결',
    detail: noEvidence.length ? `근거 문서가 연결되지 않은 조서 ${noEvidence.length}건` : '모든 작성 조서에 근거 연결',
    basis: '금감원 감리: 감사증거 수집·문서화 단계 지적 최다',
    engagementId: e.id,
    link: `${base}/sheets`,
  })
  const openNotes = input.notes.filter((n) => n.status === 'open')
  out.push({
    ruleId: 'review-notes',
    level: openNotes.length === 0 ? 'pass' : e.reportDate ? 'fail' : 'warn',
    category: '조서',
    title: '미해결 리뷰 노트',
    detail: openNotes.length ? `미해결 ${openNotes.length}건` : '모두 해결됨',
    basis: '감사기준서 230 감사문서화',
    engagementId: e.id,
    link: `${base}/sheets`,
  })

  // 5. 외부조회: 미회신 건 대체절차
  const noReply = input.confirmations.filter((c) => c.status === 'no_reply' && !c.alternativeProcedure)
  const exceptions = input.confirmations.filter((c) => c.status === 'exception' && !c.alternativeProcedure)
  out.push({
    ruleId: 'confirmation-alt',
    level: noReply.length + exceptions.length ? 'fail' : 'pass',
    category: '외부조회',
    title: '미회신·차이 조회서의 대체절차',
    detail:
      noReply.length + exceptions.length
        ? `대체절차 기록 없음: 미회신 ${noReply.length}건, 차이 ${exceptions.length}건`
        : '모든 건 처리됨',
    basis: '감사기준서 505 · 한공회 감리 사례(미회신 대체절차 미흡)',
    engagementId: e.id,
    link: `${base}/confirmations`,
  })

  // 6. 업무품질검토(심리)
  if (e.eqrId) {
    const eqrDone = procs.some((n) => hasSignOff(n, 'eqr'))
    out.push({
      ruleId: 'eqr',
      level: eqrDone ? 'pass' : e.reportDate ? 'fail' : 'warn',
      category: '심리',
      title: '업무품질검토(심리) 완료 서명',
      detail: eqrDone ? `심리자 ${name(e.eqrId)} 서명` : `심리자 ${name(e.eqrId)} 서명 없음`,
      basis: '품질관리기준서 2 · 금감원 감리(사전심리 문서화)',
      engagementId: e.id,
      link: `${base}/sheets`,
    })
  }

  // 7. 조서 취합 기한
  if (e.reportDate) {
    const due = addDays(e.reportDate, 60)
    const late = e.archivedDate ? e.archivedDate > due : asOf > due
    const left = daysBetween(asOf, due)
    out.push({
      ruleId: 'archive-60',
      level: late ? 'fail' : !e.archivedDate && left <= 14 ? 'warn' : 'pass',
      category: '조서 보존',
      title: '감사조서 60일 내 취합',
      detail: e.archivedDate
        ? `취합 완료 ${e.archivedDate} (기한 ${due})`
        : late
          ? `기한 ${due} 경과, 미취합`
          : `기한 ${due}까지 ${left}일`,
      basis: '금감원 감리 지적(보고서일 후 60일 초과 취합)',
      engagementId: e.id,
      link: `${base}/documents`,
    })
  }

  return out
}

export function scoreFindings(f: InspectionFinding[]) {
  return {
    fail: f.filter((x) => x.level === 'fail').length,
    warn: f.filter((x) => x.level === 'warn').length,
    pass: f.filter((x) => x.level === 'pass').length,
  }
}

// ---------------------------------------------------------------- 자료 요청 분석 (고객 포털·감사인 공통)

export interface RequestMetrics {
  total: number
  accepted: number
  submitted: number
  outstanding: number
  pctComplete: number
  /** 앞으로 30일 동안 날짜별 마감 건수(미승인 기준) */
  comingDue: { date: string; count: number }[]
  /** 기한이 지난 미제출 건의 지연 일수 분포 */
  overdue: { label: string; count: number }[]
  overdueCount: number
  avgDaysOverdue: number
  /** 제출된 적 있는 건 중 기한 내 제출 비율 */
  onTimePct: number
  submittedEver: number
  returnedPct: number
  returnedMultiplePct: number
}

export function requestMetrics(requests: AuditRequest[], today: string): RequestMetrics {
  const total = requests.length
  const accepted = requests.filter((r) => r.status === 'accepted').length
  const submitted = requests.filter((r) => r.status === 'submitted' || r.status === 'in_review').length
  const outstandingList = requests.filter((r) => r.status === 'open' || r.status === 'returned')
  const comingDue = Array.from({ length: 30 }, (_, i) => {
    const date = addDays(today, i)
    return { date, count: requests.filter((r) => r.status !== 'accepted' && r.dueDate === date).length }
  })
  const lateDays = outstandingList.filter((r) => r.dueDate < today).map((r) => daysBetween(r.dueDate, today))
  const buckets: [string, (d: number) => boolean][] = [
    ['1일', (d) => d === 1],
    ['2일', (d) => d === 2],
    ['3일', (d) => d === 3],
    ['4일', (d) => d === 4],
    ['5~10일', (d) => d >= 5 && d <= 10],
    ['10일 초과', (d) => d > 10],
  ]
  const ever = requests.filter((r) => r.submittedAt)
  const onTime = ever.filter((r) => r.submittedAt! <= r.dueDate)
  return {
    total,
    accepted,
    submitted,
    outstanding: outstandingList.length,
    pctComplete: total ? Math.round((accepted / total) * 100) : 0,
    comingDue,
    overdue: buckets.map(([label, f]) => ({ label, count: lateDays.filter(f).length })),
    overdueCount: lateDays.length,
    avgDaysOverdue: lateDays.length ? Math.round((lateDays.reduce((a, b) => a + b, 0) / lateDays.length) * 10) / 10 : 0,
    onTimePct: ever.length ? Math.round((onTime.length / ever.length) * 1000) / 10 : 0,
    submittedEver: ever.length,
    returnedPct: ever.length ? Math.round((ever.filter((r) => r.returnCount > 0).length / ever.length) * 1000) / 10 : 0,
    returnedMultiplePct: ever.length ? Math.round((ever.filter((r) => r.returnCount > 1).length / ever.length) * 1000) / 10 : 0,
  }
}
