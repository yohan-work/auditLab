// 설정·계정 화면용 시연 데이터. 실제 연동·요금제와 무관한 가상 값이다.
import type { AccessLogEntry, Integration, NotificationPref } from '@/domain/types'

export const integrations: Integration[] = [
  { id: 'kftc', name: '금융결제원 회계감사자료 온라인 발급', category: '외부조회', kr: true, status: 'connected', lastSync: '2026-10-13 09:12', description: '은행·증권 금융거래조회서 회신 파일을 가져와 조회서 목록과 대사합니다.' },
  { id: 'nice', name: 'NICE 채권채무 전자조회', category: '외부조회', kr: true, status: 'connected', lastSync: '2026-10-15 14:40', description: '거래처 채권·채무 조회서 회신 리포트를 가져옵니다.' },
  { id: 'dart', name: 'OpenDART', category: '공시·데이터', kr: true, status: 'connected', lastSync: '2026-10-21 06:00', description: '전기 감사보고서와 공시 재무정보를 불러와 전기 금액과 대사합니다.' },
  { id: 'alphalyzer', name: '한공회 Alphalyzer 결과 가져오기', category: '분석', kr: true, status: 'available', description: 'JET·벤포드 등 분석 결과 파일을 조서 근거로 연결합니다.' },
  { id: 'douzone', name: '더존 원장 내보내기 파일', category: '회계 시스템', kr: true, status: 'available', description: '회사가 제출한 더존 시산표·분개장 엑셀 형식을 자동 인식합니다.' },
  { id: 'hometax', name: '홈택스 전자세금계산서 목록', category: '공시·데이터', kr: true, status: 'planned', description: '회사가 내려받은 매출·매입 전자세금계산서 목록을 원장과 대사합니다.' },
  { id: 'excel', name: 'Excel 애드인', category: '협업', kr: false, status: 'planned', description: '엑셀 조서 셀과 근거 문서를 연결하는 작업창(개발 예정).' },
  { id: 'storage', name: '국내 리전 문서 저장소', category: '저장소', kr: true, status: 'planned', description: '감사조서 8년 보존, 암호화, 변조 방지 해시를 지원하는 저장소.' },
]

export const notificationPrefs: NotificationPref[] = [
  { id: 'n-request', label: '고객 자료 제출', description: '고객사가 요청 자료를 올리거나 댓글을 남길 때', inApp: true, email: true },
  { id: 'n-review', label: '리뷰 노트', description: '나에게 리뷰 노트가 배정되거나 해결될 때', inApp: true, email: false },
  { id: 'n-signoff', label: '서명 요청', description: '검토·심리 서명을 기다리는 조서가 있을 때', inApp: true, email: false },
  { id: 'n-deadline', label: '법정 기한', description: '재무제표 수령·보고서 제출·조서 취합 기한 14일 전', inApp: true, email: true },
  { id: 'n-inspection', label: '감리 모의고사', description: '지적 예상 항목이 새로 생길 때', inApp: true, email: true },
  { id: 'n-independence', label: '독립성 확인서', description: '연 1회 확인서 제출 기한 안내', inApp: true, email: true },
]

export const accessLog: AccessLogEntry[] = [
  { id: 'al-1', at: '2026-10-21 09:02', userId: 'u-park', action: '로그인', target: '웹', ip: '211.0.0.12' },
  { id: 'al-2', at: '2026-10-21 08:55', userId: 'u-lee', action: '문서 다운로드', target: '채권채무조회_회신리포트_NICE.xlsx', ip: '211.0.0.14' },
  { id: 'al-3', at: '2026-10-20 17:31', userId: 'u-kim', action: '서명', target: 'P-23 부정위험 평가 · 검토자', ip: '211.0.0.10' },
  { id: 'al-4', at: '2026-10-19 16:40', userId: 'c-han', action: '파일 업로드', target: '매출전자세금계산서목록_2026_1-9월.xlsx', ip: '121.0.0.77' },
  { id: 'al-5', at: '2026-10-18 09:20', userId: 'u-kim', action: '리뷰 노트 작성', target: 'P-24 계획단계 분석적 검토', ip: '211.0.0.10' },
  { id: 'al-6', at: '2026-10-16 11:05', userId: 'u-choi', action: '문서 업로드', target: 'Alphalyzer_JET_결과_2026_1-9월.xlsx', ip: '211.0.0.15' },
]

export const helpLinks = [
  { title: '처음 시작하기', desc: '감사 업무 생성부터 조서 마감까지 5분 둘러보기' },
  { title: '자료 요청과 고객 포털', desc: '고객사 담당자 초대, 요청·반려 흐름' },
  { title: '감리 모의고사 규칙 설명', desc: '각 점검 항목과 근거 기준' },
  { title: '외부조회 가져오기', desc: '금융결제원·NICE 회신 파일 형식' },
  { title: '데이터 보안과 보존', desc: '저장 위치, 암호화, 8년 보존 정책(설계 방향)' },
]

export const shortcuts = [
  ['G then E', '감사 업무 목록'],
  ['G then I', '인박스'],
  ['/', '워크플로 검색'],
  ['S', '선택한 조서에 서명'],
  ['N', '리뷰 노트 작성'],
]

export const releaseNotes = [
  { date: '2026-10-21', title: '감리 모의고사 베타', desc: '금감원·한공회 감리 지적 상위 항목을 자동 점검합니다.' },
  { date: '2026-10-14', title: 'DART 전기 대사', desc: '재무제표 화면에서 전기 공시 금액과의 불일치를 표시합니다.' },
  { date: '2026-10-07', title: '고객 포털', desc: '고객사 담당자가 요청 자료를 직접 올리고 답변합니다.' },
]
