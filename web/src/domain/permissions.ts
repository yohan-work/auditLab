// 역할별 권한. 설정 화면의 권한표와 쓰기 작업 검사가 모두 이 표 하나를 쓴다.
// 실제 서비스에서는 서버가 같은 표로 최종 검사한다(화면 검사는 사용성용).
import type { Role } from './types'

export type Action =
  | 'engagement.manage'
  | 'signoff.preparer'
  | 'signoff.reviewer'
  | 'signoff.eqr'
  | 'time.approve'
  | 'request.decide'
  | 'engagement.archive'

export const permissionMatrix: { action: Action; label: string; roles: Role[] }[] = [
  { action: 'engagement.manage', label: '감사 업무 생성·설정', roles: ['partner', 'manager'] },
  { action: 'signoff.preparer', label: '조서 작성 서명', roles: ['partner', 'manager', 'senior', 'staff'] },
  { action: 'signoff.reviewer', label: '조서 검토 서명', roles: ['partner', 'manager'] },
  { action: 'signoff.eqr', label: '심리 서명 (지정된 심리자 본인)', roles: ['eqr'] },
  { action: 'time.approve', label: '감사시간 승인', roles: ['partner', 'manager'] },
  { action: 'request.decide', label: '고객 자료 승인·반려', roles: ['partner', 'manager', 'senior'] },
  { action: 'engagement.archive', label: '조서 최종 취합(잠금)', roles: ['partner'] },
]

export function can(role: Role, action: Action): boolean {
  return permissionMatrix.find((p) => p.action === action)?.roles.includes(role) ?? false
}

export const roleLabel: Record<Role, string> = {
  partner: '업무수행이사',
  manager: '책임자',
  senior: '현장책임',
  staff: '담당',
  eqr: '심리(업무품질검토)',
  client: '고객사',
}
