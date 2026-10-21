// 시연용 합성 데이터. 실제 회사·인물과 무관한 가상 데이터다.
import type {
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
  Questionnaire,
  ReviewNote,
  TimeEntry,
  User,
  WorkflowNode,
} from '@/domain/types'

export const DEMO_TODAY = '2026-10-21'
export const CURRENT_USER_ID = 'u-park'
export const PRIMARY_ENGAGEMENT_ID = 'e-sample-2026'

let seedState = 20261021
function rand() {
  seedState = (seedState * 1103515245 + 12345) % 2147483648
  return seedState / 2147483648
}
const pick = <T,>(arr: T[]) => arr[Math.floor(rand() * arr.length)]

export const firm: Firm = { id: 'f-1', name: '가온 감사반', kind: 'audit_team' }

export const users: User[] = [
  { id: 'u-kim', name: '김지현', initials: '김지', role: 'partner', title: '대표 회계사', color: '#dbeafe' },
  { id: 'u-park', name: '박서준', initials: '박서', role: 'manager', title: '책임 회계사', color: '#dcfce7' },
  { id: 'u-lee', name: '이하은', initials: '이하', role: 'senior', title: '회계사', color: '#fef3c7' },
  { id: 'u-choi', name: '최도윤', initials: '최도', role: 'staff', title: '수습 회계사', color: '#fce7f3' },
  { id: 'u-jung', name: '정민서', initials: '정민', role: 'eqr', title: '심리 회계사', color: '#ede9fe' },
  { id: 'c-oh', name: '오세영', initials: '오세', role: 'client', title: '샘플제조 재무팀장', color: '#e0f2fe', clientId: 'cl-sample' },
  { id: 'c-han', name: '한유진', initials: '한유', role: 'client', title: '샘플제조 회계담당', color: '#e0f2fe', clientId: 'cl-sample' },
]

const clientNames: [string, string][] = [
  ['샘플제조', '제조업(자동차 부품)'],
  ['한결테크', '소프트웨어 개발'],
  ['바른식품', '식료품 제조'],
  ['누리물류', '운송·창고'],
  ['다온건설', '종합건설'],
  ['세움바이오', '의약품 연구개발'],
  ['하람소재', '화학소재 제조'],
  ['이룸유통', '도소매'],
  ['가람전자', '전자부품 제조'],
  ['소담에너지', '태양광 발전'],
  ['온새미의료기', '의료기기 제조'],
  ['미르모빌리티', '모빌리티 서비스'],
]

export const clients: Client[] = clientNames.map(([name, industry], i) => ({
  id: i === 0 ? 'cl-sample' : `cl-${i}`,
  name: `${name}㈜`,
  bizNo: `${120 + i}-81-${String(10000 + i * 7919).slice(0, 5)}`,
  industry,
  fiscalYearEnd: '12-31',
  listed: false,
  assets: Math.round((150 + rand() * 900) * 1e8),
  contactUserId: i === 0 ? 'c-oh' : undefined,
}))

// ---------------------------------------------------------------- 감사 업무

const team = ['u-park', 'u-lee', 'u-choi']

export const engagements: Engagement[] = [
  {
    id: PRIMARY_ENGAGEMENT_ID,
    clientId: 'cl-sample',
    name: '2026 외부감사',
    type: '외부감사',
    fiscalYear: 2026,
    status: 'in_progress',
    startDate: '2026-07-01',
    leadId: 'u-kim',
    teamIds: team,
    eqrId: 'u-jung',
    agmDate: '2027-03-26',
    standardHours: 620,
    materiality: 420_000_000,
  },
  {
    id: 'e-sample-2025',
    clientId: 'cl-sample',
    name: '2025 외부감사',
    type: '외부감사',
    fiscalYear: 2025,
    status: 'complete',
    startDate: '2025-07-01',
    endDate: '2026-03-18',
    leadId: 'u-kim',
    teamIds: team,
    eqrId: 'u-jung',
    agmDate: '2026-03-27',
    fsReceivedDate: '2026-02-11',
    reportDate: '2026-03-18',
    archivedDate: '2026-05-08',
    standardHours: 600,
  },
]

clients.slice(1).forEach((c, i) => {
  const status = (['in_progress', 'in_progress', 'pending', 'complete', 'in_progress', 'pending', 'complete', 'in_progress', 'archived', 'in_progress', 'pending'] as const)[i]
  const done = status === 'complete' || status === 'archived'
  const fy = done ? 2025 : 2026
  engagements.push({
    id: `e-${i + 1}`,
    clientId: c.id,
    name: i === 4 ? '2026 반기검토' : `${fy} 외부감사`,
    type: i === 4 ? '반기검토' : '외부감사',
    fiscalYear: fy,
    status,
    startDate: status === 'pending' ? undefined : `${fy}-0${(i % 3) + 6}-0${(i % 8) + 1}`,
    endDate: done ? `${fy + 1}-03-1${i % 9}` : undefined,
    leadId: 'u-kim',
    teamIds: i % 4 === 0 ? ['u-park', 'u-lee'] : team,
    eqrId: 'u-jung',
    agmDate: `${fy + 1}-03-2${(i % 7) + 1}`,
    reportDate: done ? `${fy + 1}-03-1${i % 9}` : undefined,
    archivedDate: status === 'archived' ? `${fy + 1}-05-02` : undefined,
    standardHours: 300 + Math.round(rand() * 500),
  })
})

// ---------------------------------------------------------------- 조서 워크플로 (주 업무)

type NodeSeed = [code: string, title: string, std?: string, children?: NodeSeed[]]

const tree: Record<'planning' | 'execution' | 'concluding', NodeSeed[]> = {
  planning: [
    ['P-01', '업무 수임·유지 검토', '감사기준서 220'],
    ['P-02', '감사팀 독립성 확인', '감사기준서 220'],
    ['P-03', '감사계약 및 업무 범위 합의', '감사기준서 210'],
    ['P-10', '중요성', undefined, [['P-11', '전체 중요성·수행중요성 결정', '감사기준서 320']]],
    [
      'P-20',
      '위험평가',
      undefined,
      [
        ['P-21', '기업과 기업환경 이해', '감사기준서 315'],
        ['P-22', '내부통제 이해 및 설계 평가', '감사기준서 315'],
        ['P-23', '부정위험 평가 및 경영진 질문', '감사기준서 240'],
        ['P-24', '계획단계 분석적 검토', '감사기준서 520'],
      ],
    ],
    ['P-30', '전반감사전략·감사계획 수립', '감사기준서 300'],
  ],
  execution: [
    ['E-10', '현금및현금성자산', undefined, [['E-11', '금융기관 조회 (금융결제원)', '감사기준서 505'], ['E-12', '은행 잔액 대사', '감사기준서 500']]],
    [
      'E-20',
      '매출채권',
      undefined,
      [
        ['E-21', '채권 조회 (NICE 전자조회)', '감사기준서 505'],
        ['E-22', '매출 기간귀속(Cut-off) 검토', '감사기준서 330'],
        ['E-23', '대손충당금 추정 검토', '감사기준서 540'],
      ],
    ],
    ['E-30', '재고자산', undefined, [['E-31', '재고실사 입회', '감사기준서 501'], ['E-32', '재고자산 평가', '감사기준서 540']]],
    ['E-40', '유형자산', undefined, [['E-41', '취득·처분 증빙 검토', '감사기준서 500'], ['E-42', '감가상각비 재계산', '감사기준서 520']]],
    ['E-50', '매입채무', undefined, [['E-51', '미기록부채 검토', '감사기준서 330']]],
    ['E-60', '매출', undefined, [['E-61', '매출 실증 — 전자세금계산서 대사', '감사기준서 500']]],
    ['E-70', '분개 테스트 (Alphalyzer 결과)', '감사기준서 240'],
  ],
  concluding: [
    ['C-10', '후속사건 검토', '감사기준서 560'],
    ['C-11', '계속기업 가정 검토', '감사기준서 570'],
    ['C-12', '경영진 서면진술', '감사기준서 580'],
    ['C-13', '지배기구와의 커뮤니케이션', '감사기준서 260'],
    ['C-20', '업무품질검토(심리)', '품질관리기준서 2'],
    ['C-30', '감사의견 형성 및 보고', '감사기준서 700'],
    ['C-40', '감사조서 최종 취합·보존', '감사기준서 230'],
  ],
}

const phaseTitle = { planning: '1. 계획', execution: '2. 실행', concluding: '3. 완료' }
const reviewedCodes = new Set(['P-01', 'P-02', 'P-03', 'P-11', 'P-21', 'P-22', 'P-23', 'E-11', 'E-31'])
const preparedCodes = new Set(['P-24', 'P-30', 'E-12', 'E-21', 'E-22', 'E-41', 'E-70'])
const evidenceByCode: Record<string, string[]> = {
  'P-11': ['d-tb'],
  'P-24': ['d-tb', 'd-dart-2025'],
  'E-11': ['d-kftc'],
  'E-12': ['d-kftc', 'd-bank'],
  'E-21': ['d-nice'],
  'E-22': ['d-gl', 'd-hometax'],
  'E-31': ['d-inv-count'],
  'E-70': ['d-alpha'],
}

export const workflow: WorkflowNode[] = []
;(Object.keys(tree) as (keyof typeof tree)[]).forEach((phase, pi) => {
  const rootId = `n-${phase}`
  workflow.push({
    id: rootId,
    engagementId: PRIMARY_ENGAGEMENT_ID,
    type: 'folder',
    code: String(pi + 1),
    title: phaseTitle[phase],
    phase,
    order: pi,
    signOffs: [],
    evidence: [],
  })
  const walk = (items: NodeSeed[], parentId: string) =>
    items.forEach(([code, title, std, children], i) => {
      const id = `n-${code}`
      const isFolder = !!children
      const signOffs: WorkflowNode['signOffs'] = []
      if (reviewedCodes.has(code) || preparedCodes.has(code)) {
        signOffs.push({ userId: pick(['u-lee', 'u-choi']), role: 'preparer', at: '2026-09-1' + (i % 9) })
      }
      if (reviewedCodes.has(code)) signOffs.push({ userId: 'u-park', role: 'reviewer', at: '2026-09-2' + (i % 9) })
      workflow.push({
        id,
        engagementId: PRIMARY_ENGAGEMENT_ID,
        parentId,
        type: isFolder ? 'folder' : code === 'P-01' || code === 'P-11' ? 'form' : 'procedure',
        code,
        title,
        phase,
        order: i,
        assigneeId: isFolder ? undefined : pick(['u-lee', 'u-choi', 'u-park']),
        kicpaRef: std,
        objective: isFolder ? undefined : `${title}에 대한 충분하고 적합한 감사증거를 입수한다.`,
        steps: isFolder
          ? undefined
          : ['관련 자료를 요청·입수한다.', '절차를 수행하고 결과를 기록한다.', '예외사항을 평가하고 결론을 기술한다.'],
        conclusion: reviewedCodes.has(code) ? '수행한 절차 결과 중요한 왜곡표시는 발견되지 않았다.' : undefined,
        signOffs,
        evidence: (evidenceByCode[code] ?? []).map((documentId, k) => ({
          documentId,
          locator: k === 0 ? 'p.1 · 요약표' : '시트 1 · 전체',
        })),
      })
      if (children) walk(children, id)
    })
  walk(tree[phase], rootId)
})

export const reviewNotes: ReviewNote[] = [
  { id: 'rn-1', engagementId: PRIMARY_ENGAGEMENT_ID, nodeId: 'n-E-21', authorId: 'u-park', assigneeId: 'u-lee', text: '㈜동방상사 회신 금액 차이 1,250만원 — 차이 원인과 대체절차를 기록해 주세요.', status: 'open', createdAt: '2026-10-14' },
  { id: 'rn-2', engagementId: PRIMARY_ENGAGEMENT_ID, nodeId: 'n-E-70', authorId: 'u-park', assigneeId: 'u-choi', text: '주말 전기 전표 23건 중 표본 5건의 증빙 확인 결과를 첨부해 주세요.', status: 'open', createdAt: '2026-10-16' },
  { id: 'rn-3', engagementId: PRIMARY_ENGAGEMENT_ID, nodeId: 'n-P-24', authorId: 'u-kim', assigneeId: 'u-park', text: '매출총이익률 하락(18.2%→15.9%) 원인에 대한 경영진 설명을 추가해 주세요.', status: 'open', createdAt: '2026-10-18' },
  { id: 'rn-4', engagementId: PRIMARY_ENGAGEMENT_ID, nodeId: 'n-E-31', authorId: 'u-park', assigneeId: 'u-choi', text: '실사 차이 2건 조정 내역 확인 완료.', status: 'resolved', createdAt: '2026-10-02', resolvedAt: '2026-10-05' },
]

// ---------------------------------------------------------------- 문서

const doc = (
  id: string,
  name: string,
  ext: AuditDocument['ext'],
  source: AuditDocument['source'],
  folder: string,
  uploadedAt: string,
  requestId?: string,
): AuditDocument => ({
  id,
  engagementId: PRIMARY_ENGAGEMENT_ID,
  name,
  ext,
  sizeKb: Math.round(40 + rand() * 900),
  source,
  uploadedBy: source === 'client' ? 'c-han' : 'u-lee',
  uploadedAt,
  requestId,
  folder,
})

export const documents: AuditDocument[] = [
  doc('d-tb', '합계잔액시산표_2026_9월.xlsx', 'xlsx', 'client', '회사 제출자료', '2026-10-06', 'r-1'),
  doc('d-gl', '분개장_2026_1-9월.xlsx', 'xlsx', 'client', '회사 제출자료', '2026-10-06', 'r-2'),
  doc('d-bank', '은행거래내역_KB국민_보통예금.xlsx', 'xlsx', 'client', '회사 제출자료', '2026-10-08', 'r-4'),
  doc('d-hometax', '매출전자세금계산서목록_2026_1-9월.xlsx', 'xlsx', 'client', '회사 제출자료', '2026-10-09', 'r-5'),
  doc('d-fixed', '유형자산명세서_2026.xlsx', 'xlsx', 'client', '회사 제출자료', '2026-10-10', 'r-7'),
  doc('d-contract', '주요 매출계약서_현대부품.pdf', 'pdf', 'client', '회사 제출자료', '2026-10-11', 'r-9'),
  doc('d-minutes', '이사회의사록_2026.pdf', 'pdf', 'client', '회사 제출자료', '2026-10-12', 'r-10'),
  doc('d-inv-count', '재고실사표_2026_6월.xlsx', 'xlsx', 'firm', '감사팀 작성', '2026-07-02'),
  doc('d-kftc', '금융거래조회서_회신_금융결제원.pdf', 'pdf', 'kftc', '외부조회', '2026-10-13'),
  doc('d-nice', '채권채무조회_회신리포트_NICE.xlsx', 'xlsx', 'nice', '외부조회', '2026-10-15'),
  doc('d-alpha', 'Alphalyzer_JET_결과_2026_1-9월.xlsx', 'xlsx', 'alphalyzer', '분석 결과', '2026-10-16'),
  doc('d-dart-2025', '감사보고서_2025_샘플제조_DART.pdf', 'pdf', 'dart', '공시자료', '2026-07-01'),
  doc('d-plan', '감사계획서_2026.docx', 'docx', 'firm', '감사팀 작성', '2026-08-20'),
  doc('d-engage', '감사계약서_2026.pdf', 'pdf', 'firm', '감사팀 작성', '2026-07-01'),
]

// ---------------------------------------------------------------- 자료 요청(PBC)

const requestSeeds: [string, string, string, AuditRequest['status'], string, string[]?][] = [
  ['R-01', '합계잔액시산표(9월말)', '일반', 'accepted', '2026-10-05', ['d-tb']],
  ['R-02', '분개장 전체(1~9월)', '일반', 'accepted', '2026-10-05', ['d-gl']],
  ['R-03', '계정별원장 — 외상매출금', '매출채권', 'in_review', '2026-10-10'],
  ['R-04', '은행 거래내역(전 계좌)', '현금', 'accepted', '2026-10-07', ['d-bank']],
  ['R-05', '홈택스 매출 전자세금계산서 목록', '매출', 'submitted', '2026-10-10', ['d-hometax']],
  ['R-06', '홈택스 매입 전자세금계산서 목록', '매입', 'open', '2026-10-24'],
  ['R-07', '유형자산 명세서 및 취득 증빙', '유형자산', 'accepted', '2026-10-10', ['d-fixed']],
  ['R-08', '차입금 약정서 및 상환스케줄', '차입금', 'open', '2026-10-28'],
  ['R-09', '주요 매출계약서(상위 5개 거래처)', '매출', 'returned', '2026-10-12', ['d-contract']],
  ['R-10', '이사회·주주총회 의사록', '일반', 'accepted', '2026-10-12', ['d-minutes']],
  ['R-11', '재고자산 수불부(월별)', '재고', 'open', '2026-10-30'],
  ['R-12', '퇴직급여 계리평가 보고서', '충당부채', 'open', '2026-11-15'],
  ['R-13', '특수관계자 거래 명세', '공시', 'open', '2026-11-15'],
  ['R-14', '법인세 신고서(전기)', '세무', 'submitted', '2026-10-20'],
  ['R-15', '소송·우발부채 현황(법률 조회 대상)', '공시', 'open', '2026-11-30'],
  ['R-16', '급여대장(3·6·9월)', '비용', 'in_review', '2026-10-15'],
]

export const requests: AuditRequest[] = requestSeeds.map(([code, title, category, status, dueDate, docs], i) => ({
  id: `r-${i + 1}`,
  engagementId: PRIMARY_ENGAGEMENT_ID,
  code,
  title,
  description: `${title}를 엑셀 원본(가공 전) 형식으로 제출해 주십시오.`,
  category,
  status,
  ownerId: pick(team),
  clientAssigneeId: i % 3 === 0 ? 'c-oh' : 'c-han',
  dueDate,
  documentIds: docs ?? [],
  comments:
    status === 'returned'
      ? [
          { id: `cm-${i}`, authorId: 'u-lee', text: '서명 페이지가 누락되어 있습니다. 전체 사본으로 다시 올려주세요.', at: '2026-10-13T10:12' },
        ]
      : status === 'submitted'
        ? [{ id: `cm-${i}`, authorId: 'c-han', text: '업로드했습니다. 확인 부탁드립니다.', at: '2026-10-19T16:40' }]
        : [],
}))

// 다른 감사 업무에는 상태 분포만 있는 가벼운 요청을 만든다.
engagements.slice(1).forEach((e, ei) => {
  const n = 4 + Math.floor(rand() * 16)
  for (let k = 0; k < n; k++) {
    const status: AuditRequest['status'] =
      e.status === 'complete' || e.status === 'archived'
        ? 'accepted'
        : e.status === 'pending'
          ? pick(['open', 'open', 'open', 'submitted'])
          : pick(['open', 'submitted', 'in_review', 'accepted', 'accepted', 'returned'])
    requests.push({
      id: `r-${e.id}-${k}`,
      engagementId: e.id,
      code: `R-${String(k + 1).padStart(2, '0')}`,
      title: pick(requestSeeds)[1],
      description: '',
      category: '일반',
      status,
      ownerId: pick(team),
      dueDate: `2026-1${ei % 2}-${String(5 + k).padStart(2, '0')}`,
      documentIds: [],
      comments: [],
    })
  }
})

// ---------------------------------------------------------------- 재무제표

const fs = (
  id: string,
  statement: FSLine['statement'],
  label: string,
  level: FSLine['level'],
  kind: FSLine['kind'],
  current?: number,
  prior?: number,
  linked: string[] = [],
  dartPrior?: number,
): FSLine => ({
  id,
  engagementId: PRIMARY_ENGAGEMENT_ID,
  statement,
  label,
  level,
  kind,
  current,
  prior,
  dartPrior: dartPrior ?? prior,
  linkedNodeIds: linked,
})

// 단위: 천원
export const fsLines: FSLine[] = [
  fs('bs-a', 'BS', '자산', 0, 'header'),
  fs('bs-ca', 'BS', '유동자산', 1, 'header'),
  fs('bs-cash', 'BS', '현금및현금성자산', 2, 'line', 3_120_400, 2_754_900, ['n-E-11', 'n-E-12']),
  fs('bs-ar', 'BS', '매출채권(순액)', 2, 'line', 7_845_200, 6_571_300, ['n-E-21', 'n-E-23']),
  fs('bs-inv', 'BS', '재고자산', 2, 'line', 5_210_800, 4_980_100, ['n-E-31', 'n-E-32']),
  fs('bs-prep', 'BS', '선급비용', 2, 'line', 412_300, 382_000, [], 362_000),
  fs('bs-ca-t', 'BS', '유동자산 합계', 1, 'total', 16_588_700, 14_688_300),
  fs('bs-nca', 'BS', '비유동자산', 1, 'header'),
  fs('bs-ppe', 'BS', '유형자산', 2, 'line', 11_652_000, 10_050_820, ['n-E-41', 'n-E-42']),
  fs('bs-intan', 'BS', '무형자산', 2, 'line', 640_500, 702_100),
  fs('bs-nca-t', 'BS', '비유동자산 합계', 1, 'total', 12_292_500, 10_752_920),
  fs('bs-a-t', 'BS', '자산 총계', 0, 'total', 28_881_200, 25_441_220),
  fs('bs-l', 'BS', '부채', 0, 'header'),
  fs('bs-cl', 'BS', '유동부채', 1, 'header'),
  fs('bs-ap', 'BS', '매입채무', 2, 'line', 4_502_600, 4_150_200, ['n-E-51']),
  fs('bs-std', 'BS', '단기차입금', 2, 'line', 3_000_000, 3_500_000),
  fs('bs-accr', 'BS', '미지급비용', 2, 'line', 820_400, 765_300),
  fs('bs-cl-t', 'BS', '유동부채 합계', 1, 'total', 8_323_000, 8_415_500),
  fs('bs-ncl', 'BS', '비유동부채', 1, 'header'),
  fs('bs-ltd', 'BS', '장기차입금', 2, 'line', 5_200_000, 4_000_000),
  fs('bs-ret', 'BS', '퇴직급여부채', 2, 'line', 1_105_300, 982_400),
  fs('bs-ncl-t', 'BS', '비유동부채 합계', 1, 'total', 6_305_300, 4_982_400),
  fs('bs-l-t', 'BS', '부채 총계', 0, 'total', 14_628_300, 13_397_900),
  fs('bs-eq', 'BS', '자본', 0, 'header'),
  fs('bs-cap', 'BS', '자본금', 2, 'line', 2_000_000, 2_000_000),
  fs('bs-re', 'BS', '이익잉여금', 2, 'line', 12_252_900, 10_043_320),
  fs('bs-eq-t', 'BS', '자본 총계', 0, 'total', 14_252_900, 12_043_320),
  fs('is-rev', 'IS', '매출액', 2, 'line', 32_410_000, 38_950_200, ['n-E-61', 'n-E-22']),
  fs('is-cogs', 'IS', '매출원가', 2, 'line', 27_257_000, 31_861_300),
  fs('is-gp', 'IS', '매출총이익', 1, 'total', 5_153_000, 7_088_900),
  fs('is-sga', 'IS', '판매비와관리비', 2, 'line', 2_380_400, 3_105_600),
  fs('is-op', 'IS', '영업이익', 1, 'total', 2_772_600, 3_983_300),
  fs('is-fin', 'IS', '금융비용', 2, 'line', 312_000, 401_200),
  fs('is-tax', 'IS', '법인세비용', 2, 'line', 251_020, 812_400),
  fs('is-ni', 'IS', '당기순이익', 0, 'total', 2_209_580, 2_769_700),
]

// ---------------------------------------------------------------- 감사시간

export const timeEntries: TimeEntry[] = []
const memo = ['계획 회의', '위험평가 문서화', '조회서 발송·회수', '재고실사 입회', '분개 테스트 검토', '조서 검토', '고객 미팅']
;['u-kim', 'u-park', 'u-lee', 'u-choi', 'u-jung'].forEach((uid) => {
  const n = uid === 'u-lee' || uid === 'u-choi' ? 9 : uid === 'u-jung' ? 1 : 5
  for (let k = 0; k < n; k++) {
    const approved = !(uid === 'u-choi' && k > 5)
    timeEntries.push({
      id: `t-${uid}-${k}`,
      engagementId: PRIMARY_ENGAGEMENT_ID,
      userId: uid,
      date: `2026-${k < 3 ? '08' : k < 6 ? '09' : '10'}-${String(3 + k * 3).padStart(2, '0')}`,
      hours: uid === 'u-kim' ? 4 + Math.round(rand() * 4) : 6 + Math.round(rand() * 10),
      memo: pick(memo),
      approvedBy: approved ? 'u-park' : undefined,
      approvedAt: approved ? '2026-10-0' + ((k % 9) + 1) : undefined,
    })
  }
})

// ---------------------------------------------------------------- 외부조회

const conf = (
  id: string,
  type: Confirmation['type'],
  channel: Confirmation['channel'],
  counterparty: string,
  ledgerAmount: number,
  status: Confirmation['status'],
  confirmedAmount?: number,
  alternativeProcedure?: string,
): Confirmation => ({
  id,
  engagementId: PRIMARY_ENGAGEMENT_ID,
  type,
  channel,
  counterparty,
  ledgerAmount,
  confirmedAmount,
  status,
  sentAt: status === 'draft' ? undefined : '2026-10-02',
  repliedAt: confirmedAmount !== undefined ? '2026-10-1' + (id.length % 9) : undefined,
  alternativeProcedure,
  documentId: channel === 'kftc' ? 'd-kftc' : channel === 'nice' ? 'd-nice' : undefined,
})

export const confirmations: Confirmation[] = [
  conf('cf-1', 'bank', 'kftc', 'KB국민은행', 1_820_400_000, 'replied', 1_820_400_000),
  conf('cf-2', 'bank', 'kftc', '신한은행', 1_050_000_000, 'replied', 1_050_000_000),
  conf('cf-3', 'bank', 'kftc', 'IBK기업은행', 250_000_000, 'replied', 250_000_000),
  conf('cf-4', 'bank', 'kftc', 'NH농협은행(지역농협)', 0, 'sent'),
  conf('cf-5', 'receivable', 'nice', '현대부품㈜', 2_410_000_000, 'replied', 2_410_000_000),
  conf('cf-6', 'receivable', 'nice', '㈜동방상사', 980_500_000, 'exception', 968_000_000),
  conf('cf-7', 'receivable', 'nice', '대한오토텍㈜', 765_200_000, 'replied', 765_200_000),
  conf('cf-8', 'receivable', 'nice', '㈜세진모터스', 540_000_000, 'no_reply'),
  conf('cf-9', 'receivable', 'nice', '한성정밀㈜', 488_300_000, 'no_reply', undefined, '기간 후 입금 확인: 2026-10-08 488,300,000원 입금(국민은행 거래내역 행 2,114)'),
  conf('cf-10', 'receivable', 'nice', '㈜유진기계', 312_700_000, 'replied', 312_700_000),
  conf('cf-11', 'payable', 'mail', '포스코강판㈜', 1_204_000_000, 'replied', 1_204_000_000),
  conf('cf-12', 'payable', 'mail', '㈜신영금속', 455_800_000, 'sent'),
  conf('cf-13', 'legal', 'mail', '법무법인 한누리', 0, 'draft'),
]

// ---------------------------------------------------------------- 독립성 확인서

export const independence: IndependenceConfirmation[] = [
  { id: 'ic-1', userId: 'u-kim', year: 2026, submittedAt: '2026-01-05', signed: true },
  { id: 'ic-2', userId: 'u-park', year: 2026, submittedAt: '2026-01-06', signed: true },
  { id: 'ic-3', userId: 'u-lee', year: 2026, submittedAt: '2026-01-09', signed: true },
  { id: 'ic-4', userId: 'u-jung', year: 2026, submittedAt: '2026-01-12', signed: true },
  { id: 'ic-5', userId: 'u-choi', year: 2026, signed: false },
]

// ---------------------------------------------------------------- 서식·질문서

export const forms: AuditForm[] = [
  {
    id: 'fm-accept',
    engagementId: PRIMARY_ENGAGEMENT_ID,
    title: '업무 수임·유지 체크리스트',
    kind: '수임',
    status: 'completed',
    updatedAt: '2026-07-01',
    fields: [
      { id: 'f1', label: '경영진의 성실성에 의문을 제기할 정보가 있는가?', type: 'yesno', value: '아니오', required: true },
      { id: 'f2', label: '감사팀이 업무 수행에 필요한 역량과 시간을 갖추었는가?', type: 'yesno', value: '예', required: true },
      { id: 'f3', label: '감사보수가 표준감사시간 대비 현저히 낮지 않은가?', type: 'yesno', value: '예', required: true },
      { id: 'f4', label: '전임 감사인과의 커뮤니케이션 결과', type: 'textarea', value: '계속감사 — 해당 없음' },
    ],
  },
  {
    id: 'fm-mat',
    engagementId: PRIMARY_ENGAGEMENT_ID,
    title: '중요성 결정',
    kind: '중요성',
    status: 'completed',
    updatedAt: '2026-08-22',
    fields: [
      { id: 'm1', label: '기준 지표', type: 'select', options: ['세전이익', '매출액', '자산총계'], value: '매출액' },
      { id: 'm2', label: '기준 금액(천원)', type: 'number', value: '42,000,000' },
      { id: 'm3', label: '적용 비율(%)', type: 'number', value: '1.0' },
      { id: 'm4', label: '전체 중요성(천원)', type: 'number', value: '420,000' },
      { id: 'm5', label: '수행중요성(천원)', type: 'number', value: '315,000' },
      { id: 'm6', label: '판단 근거', type: 'textarea', value: '이익 변동성이 커 매출액을 기준으로 함.' },
    ],
  },
  {
    id: 'fm-risk',
    engagementId: PRIMARY_ENGAGEMENT_ID,
    title: '유의적 위험 평가',
    kind: '위험평가',
    status: 'draft',
    updatedAt: '2026-10-17',
    fields: [
      { id: 'k1', label: '수익인식 부정위험 존재 여부', type: 'yesno', value: '예' },
      { id: 'k2', label: '경영진 통제무력화 위험 대응 절차', type: 'textarea', value: '분개 테스트(Alphalyzer) 및 추정 검토' },
      { id: 'k3', label: '기타 유의적 위험', type: 'textarea' },
    ],
  },
]

export const questionnaires: Questionnaire[] = [
  {
    id: 'q-ic',
    engagementId: PRIMARY_ENGAGEMENT_ID,
    title: '내부통제 이해 질문서 — 매출 프로세스',
    recipientId: 'c-oh',
    status: 'answered',
    sentAt: '2026-08-25',
    questions: [
      { id: 'q1', text: '수주부터 출고, 세금계산서 발행까지 승인 절차를 설명해 주세요.', answer: '영업팀 수주 등록 → 팀장 승인 → 물류 출고 → 회계팀 전자세금계산서 발행(더존).' },
      { id: 'q2', text: '매출 단가 변경은 누가 승인합니까?', answer: '영업본부장 전결.' },
      { id: 'q3', text: '월말 매출 마감 시 기간귀속 검토를 하십니까?', answer: '출고증과 세금계산서 일자를 대조합니다.' },
    ],
  },
  {
    id: 'q-fraud',
    engagementId: PRIMARY_ENGAGEMENT_ID,
    title: '부정위험 관련 경영진 질문',
    recipientId: 'c-oh',
    status: 'sent',
    sentAt: '2026-10-15',
    questions: [
      { id: 'q4', text: '당기 중 부정 또는 부정 의심 사항을 인지한 적이 있습니까?' },
      { id: 'q5', text: '내부고발 제도가 운영되고 있습니까?' },
      { id: 'q6', text: '경영진 성과급이 매출·이익 목표와 연동되어 있습니까?' },
    ],
  },
]

// ---------------------------------------------------------------- 인박스·라이브러리

export const inbox: InboxItem[] = [
  { id: 'ib-1', userId: CURRENT_USER_ID, kind: 'request_submitted', text: '샘플제조㈜ 한유진님이 「홈택스 매출 전자세금계산서 목록」을 제출했습니다.', engagementId: PRIMARY_ENGAGEMENT_ID, link: `/engagements/${PRIMARY_ENGAGEMENT_ID}/requests`, createdAt: '2026-10-19T16:40', read: false },
  { id: 'ib-2', userId: CURRENT_USER_ID, kind: 'review_note', text: '김지현님이 「계획단계 분석적 검토」에 리뷰 노트를 남겼습니다.', engagementId: PRIMARY_ENGAGEMENT_ID, link: `/engagements/${PRIMARY_ENGAGEMENT_ID}/sheets?node=n-P-24`, createdAt: '2026-10-18T09:20', read: false },
  { id: 'ib-3', userId: CURRENT_USER_ID, kind: 'signoff_needed', text: '검토 서명을 기다리는 조서 7건이 있습니다.', engagementId: PRIMARY_ENGAGEMENT_ID, link: `/engagements/${PRIMARY_ENGAGEMENT_ID}/sheets`, createdAt: '2026-10-18T08:00', read: false },
  { id: 'ib-4', userId: CURRENT_USER_ID, kind: 'inspection', text: '감리 모의고사: 샘플제조㈜ 2026 외부감사에서 지적 예상 항목이 발견되었습니다.', engagementId: PRIMARY_ENGAGEMENT_ID, link: `/engagements/${PRIMARY_ENGAGEMENT_ID}/inspection`, createdAt: '2026-10-17T08:00', read: true },
  { id: 'ib-5', userId: CURRENT_USER_ID, kind: 'deadline', text: '최도윤님의 2026년 독립성 확인서가 아직 제출되지 않았습니다.', link: '/quality', createdAt: '2026-10-15T08:00', read: true },
  { id: 'ib-6', userId: CURRENT_USER_ID, kind: 'comment', text: '오세영님이 「주요 매출계약서」 요청에 댓글을 남겼습니다.', engagementId: PRIMARY_ENGAGEMENT_ID, link: `/engagements/${PRIMARY_ENGAGEMENT_ID}/requests`, createdAt: '2026-10-13T11:02', read: true },
]

export const controls: ControlTemplate[] = workflow
  .filter((n) => n.type !== 'folder')
  .map((n, i) => ({
    id: `ct-${n.code}`,
    code: n.code,
    title: n.title,
    area: n.phase === 'planning' ? '계획' : n.phase === 'execution' ? '실행' : '완료',
    phase: n.phase,
    description: n.objective ?? '',
    kicpaRef: n.kicpaRef,
    usedIn: 3 + ((i * 7) % 11),
  }))
