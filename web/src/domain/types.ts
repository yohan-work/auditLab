// 도메인 모델. 실제 백엔드로 옮길 때 DB 스키마·API 계약의 출발점이 된다.
// 날짜는 모두 ISO 문자열(YYYY-MM-DD 또는 전체 ISO)로 둔다.

export type ID = string

export type Role = 'partner' | 'manager' | 'senior' | 'staff' | 'eqr' | 'client'

export interface User {
  id: ID
  name: string
  initials: string
  role: Role
  title: string
  color: string // 아바타 배경
  clientId?: ID // 고객사 담당자일 때
  email?: string
  phone?: string
  cpaNo?: string // 공인회계사 등록번호(시연용 가상 번호)
}

export type FirmKind = 'firm' | 'audit_team' // 회계법인 / 감사반

export interface Firm {
  id: ID
  name: string
  kind: FirmKind
  regNo?: string // 한공회 감사반 등록번호 / 법인 등록번호(가상)
  representative?: string
  address?: string
  phone?: string
  fiscalYearStart?: string
  plan?: { name: string; seats: number; usedSeats: number; renewsAt: string; billing: '연간' | '월간' }
}

export interface Integration {
  id: ID
  name: string
  category: '외부조회' | '공시·데이터' | '분석' | '회계 시스템' | '협업' | '저장소'
  description: string
  status: 'connected' | 'available' | 'planned'
  kr: boolean
  lastSync?: string
}

export interface NotificationPref {
  id: ID
  label: string
  description: string
  inApp: boolean
  email: boolean
}

export interface AccessLogEntry {
  id: ID
  at: string
  userId: ID
  action: string
  target: string
  ip: string
  engagementId?: ID
}

export interface Client {
  id: ID
  name: string
  bizNo: string // 사업자등록번호
  industry: string
  fiscalYearEnd: string // MM-DD
  listed: boolean
  assets: number // 직전연도 자산총액(원)
  contactUserId?: ID
}

export type EngagementStatus = 'pending' | 'in_progress' | 'complete' | 'archived'
export type EngagementType = '외부감사' | '반기검토' | '내부회계 감사' | '내부회계 검토'

export interface Engagement {
  id: ID
  clientId: ID
  name: string
  type: EngagementType
  fiscalYear: number
  status: EngagementStatus
  startDate?: string
  endDate?: string
  leadId: ID // 업무수행이사
  teamIds: ID[]
  eqrId?: ID // 업무품질검토자(심리)
  agmDate?: string // 정기주주총회 예정일 — 법정 기한 계산 기준
  fsReceivedDate?: string // 회사 재무제표 수령일
  reportDate?: string // 감사보고서일
  archivedDate?: string // 조서 취합(마감) 완료일
  standardHours?: number // 표준감사시간
  materiality?: number
}

export type RequestStatus = 'open' | 'submitted' | 'in_review' | 'accepted' | 'returned'

export interface Comment {
  id: ID
  authorId: ID
  text: string
  at: string
}

export interface AuditRequest {
  id: ID
  engagementId: ID
  code: string
  title: string
  description: string
  category: string
  status: RequestStatus
  ownerId: ID // 감사팀 담당
  clientAssigneeId?: ID // 고객사 담당
  dueDate: string
  documentIds: ID[]
  comments: Comment[]
  tags: string[]
  createdAt: string // 요청일(고객 입장에서 받은 날)
  submittedAt?: string // 최초 제출일
  returnCount: number // 반려 횟수
}

export type Phase = 'planning' | 'execution' | 'concluding'
export type NodeType = 'folder' | 'procedure' | 'form'

export interface SignOff {
  userId: ID
  role: 'preparer' | 'reviewer' | 'eqr'
  at: string
}

export interface EvidenceLink {
  documentId: ID
  locator: string // 예: "p.3 · 행 12", "시트 원장!B1532"
  note?: string
}

export interface WorkflowNode {
  id: ID
  engagementId: ID
  parentId?: ID
  type: NodeType
  code: string
  title: string
  phase: Phase
  order: number
  assigneeId?: ID
  objective?: string
  steps?: string[]
  conclusion?: string
  signOffs: SignOff[]
  evidence: EvidenceLink[]
  kicpaRef?: string // 한공회 감사조서 서식 참조
}

export interface ReviewNote {
  id: ID
  engagementId: ID
  nodeId: ID
  authorId: ID
  assigneeId: ID
  text: string
  status: 'open' | 'resolved'
  createdAt: string
  resolvedAt?: string
}

export type DocumentSource = 'client' | 'firm' | 'kftc' | 'nice' | 'alphalyzer' | 'dart' | 'tieout'

export interface AuditDocument {
  id: ID
  engagementId: ID
  name: string
  ext: 'xlsx' | 'pdf' | 'docx' | 'hwp' | 'csv' | 'zip'
  sizeKb: number
  source: DocumentSource
  uploadedBy: ID
  uploadedAt: string
  requestId?: ID
  folder: string
}

export interface FSLine {
  id: ID
  engagementId: ID
  statement: 'BS' | 'IS'
  label: string
  level: 0 | 1 | 2 // 0: 대분류 헤더, 1: 소분류 헤더/합계, 2: 계정
  kind: 'header' | 'line' | 'total'
  current?: number
  prior?: number
  dartPrior?: number // DART 공시 전기 감사보고서 금액
  linkedNodeIds: ID[]
}

export interface TimeEntry {
  id: ID
  engagementId: ID
  userId: ID
  date: string
  hours: number
  nodeId?: ID
  memo: string
  approvedBy?: ID
  approvedAt?: string
}

export type ConfirmationType = 'bank' | 'receivable' | 'payable' | 'legal'
export type ConfirmationChannel = 'kftc' | 'nice' | 'mail'
export type ConfirmationStatus = 'draft' | 'sent' | 'replied' | 'no_reply' | 'exception'

export interface Confirmation {
  id: ID
  engagementId: ID
  type: ConfirmationType
  channel: ConfirmationChannel
  counterparty: string
  ledgerAmount: number
  confirmedAmount?: number
  status: ConfirmationStatus
  sentAt?: string
  repliedAt?: string
  alternativeProcedure?: string // 미회신 시 대체절차 기록
  documentId?: ID
}

export interface IndependenceConfirmation {
  id: ID
  userId: ID
  year: number
  submittedAt?: string
  signed: boolean
  exceptions?: string
}

export type FieldType = 'text' | 'textarea' | 'yesno' | 'select' | 'date' | 'number'

export interface FormField {
  id: ID
  label: string
  type: FieldType
  options?: string[]
  value?: string
  required?: boolean
}

export interface AuditForm {
  id: ID
  engagementId: ID
  title: string
  kind: '수임' | '독립성' | '중요성' | '위험평가' | '완료'
  fields: FormField[]
  status: 'draft' | 'completed'
  updatedAt: string
}

export interface Questionnaire {
  id: ID
  engagementId: ID
  title: string
  recipientId: ID
  status: 'draft' | 'sent' | 'answered'
  sentAt?: string
  questions: { id: ID; text: string; answer?: string }[]
}

export interface InboxItem {
  id: ID
  userId: ID
  kind: 'review_note' | 'request_submitted' | 'signoff_needed' | 'deadline' | 'comment' | 'inspection'
  text: string
  engagementId?: ID
  link: string
  createdAt: string
  read: boolean
}

export interface ControlTemplate {
  id: ID
  code: string
  title: string
  area: string
  phase: Phase
  description: string
  kicpaRef?: string
  usedIn: number
}

// 감리 모의고사 결과 한 건
export type CheckLevel = 'pass' | 'warn' | 'fail'

export interface InspectionFinding {
  ruleId: string
  level: CheckLevel
  category: string // 독립성 / 감사시간 / 조서 / 외부조회 / 심리 / 업무배분 ...
  title: string
  detail: string
  basis: string // 근거(기준·감리 항목)
  engagementId?: ID
  link?: string
}

// 전수대사 실행 기록과 예외별 처리 상태. 결과 자체는 입력 자료로 언제든 다시 계산된다(결정론적).
export interface TieoutRun {
  id: ID
  engagementId: ID
  dataset: string // 예: '샘플제조 2025 기말 자료'
  fiscalYear: number
  ranAt: string
  ranBy: ID
  ms: number
  exceptionCount: number
}

export interface TieoutDisposition {
  engagementId: ID
  exNo: string
  status: 'requested' | 'concluded'
  requestId?: ID
  judgment?: string
  by: ID
  at: string
}
