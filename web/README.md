# auditLab web — 감사 업무공간 프로토타입

감사 업무공간에 한국 감사 실무 기능(KR 표시)을 더한 **흐름 이해용 프로토타입**입니다.

- 모든 데이터는 합성 데이터이고, 실제 회사·인물과 무관합니다.
- 클릭하면 메모리 안의 상태가 바뀌어 흐름을 따라가 볼 수 있습니다.
- 새로고침하면 데이터가 초기화됩니다.

## 실행

```bash
cd web
npm install
npm run dev        # http://localhost:5173
npm run typecheck
npm run build
```

## 화면 구성

| 영역 | 경로 | 내용 |
|---|---|---|
| 법인 | `/engagements` | 감사 업무 목록, 새 업무 생성 |
| | `/inbox` | 알림, 내 할 일 |
| | `/clients` | 고객사 |
| | `/controls` | 절차 라이브러리(감사기준서 매핑) |
| | `/quality` **KR** | 법인 전체 감리 모의고사, 독립성 확인서, 개정 품질관리기준서 일정 |
| | `/settings` | 팀, 시연 데이터 초기화 |
| 감사 업무 | `/engagements/:id` | 대시보드(진행률, **법정 기한 KR**, 감리 요약) |
| | `…/insights` | 증감 분석, 재무비율, Alphalyzer 결과 요약 |
| | `…/sheets` | 조서 워크플로(계획·실행·완료), 작성·검토·심리 서명, 리뷰 노트, **근거 잇기** |
| | `…/forms` · `…/questionnaires` | 수임·중요성·위험평가 서식, 고객 질문서 |
| | `…/requests` | 자료 요청(PBC), 승인·반려, 댓글 |
| | `…/documents` | 문서함(회사·감사팀·결제원·NICE·Alphalyzer·DART) |
| | `…/tieout` **KR** | **매출 전수대사**: 원장 × 홈택스 전자세금계산서 × 은행 입금 3방향 대사, 예외 → 회사 확인 요청·판단 기록 → 조서 근거 |
| | `…/reporting` | 재무제표 그리드, 연결 조서, 합계 검증, **DART 전기 대사 KR** |
| | `…/confirmations` **KR** | 금융결제원·NICE 회신 가져오기, 대체절차 기록 |
| | `…/time` **KR** | 감사시간 입력·승인, 표준감사시간, 3인 배분 |
| | `…/inspection` **KR** | 감리 모의고사(감리 지적 상위 항목 자동 점검) |
| 고객 | `/portal/:id` | 고객 포털(자료 제출, 질문서 답변) |

## 매출 전수대사 엔진

- `src/domain/tieout/engine.ts`: `poc/ktieout.py`를 옮긴 결정론적 규칙 엔진입니다. 외부 의존이 없어 브라우저와 서버에서 모두 돌아갑니다.
- 입력은 `TieoutInput` 하나로 정규화합니다. 지금은 poc 가상 자료를 변환한 `src/data/mock/tieout/input.json`을 씁니다. 실제 서비스에서는 더존·홈택스·은행 엑셀 파서가 같은 형식을 만듭니다.
- poc 결과와 같은지 대조하는 명령은 아래와 같습니다.

```bash
poc/.venv/bin/python web/scripts/convert_poc_inputs.py   # poc 엑셀 → input.json (자료가 바뀌었을 때)
cd web && node scripts/check-tieout.ts                    # 예외·부가세 분해·거래처별 채권이 poc와 일치하는지 대조
```

- **엑셀 업로드**: `src/domain/tieout/parsers.ts`가 파일 이름이 아니라 내용(제목·머리글)으로 분개장, 홈택스 매출·매입 목록, 은행 거래내역, 거래처원장, 거래처등록, 부가세 신고서를 알아봅니다. 브라우저에서 SheetJS로 읽고 서버로 보내지 않습니다.
- **매입 대사**: `src/domain/tieout/purchase.ts`. 원장(251) × 홈택스 매입 × 은행 출금으로 미기록 부채, 기간귀속, 중복 수취, 에누리 미반영, 후속기간 지급 전수 검토를 다룹니다.
- 시연 엑셀은 `public/samples/`에 있습니다(01~10은 poc 가상 자료, 11~12 매입 목록은 `scripts/make_purchase_samples.py`로 생성).

```bash
cd web && node scripts/check-parsers.ts    # 엑셀 업로드 경로 = 변환 JSON, 엔진 결과 동일
cd web && node scripts/check-purchase.ts   # 매입: 심어 둔 6건 발견, 오탐 0, 미설명 차이 0
```

- 엔진은 시연 자료에 맞춰 조정되어 있습니다. 실제 자료에서의 성능은 파일럿에서 측정합니다.

## 구조와 확장 경로

```
src/
├── domain/
│   ├── types.ts     도메인 모델 — DB 스키마·API 계약의 출발점
│   └── rules.ts     순수 업무 규칙(법정 기한, 진행률, 감리 점검). 서버에서도 그대로 재사용
├── data/
│   ├── mock/seed.ts 합성 데이터
│   ├── store.ts     시연용 인메모리 저장소(zustand)
│   ├── api.ts       쓰기 계약 AuditApi + mockApi 구현 ← 실제 백엔드 교체 지점
│   └── hooks.ts     읽기 훅 ← 실제 백엔드 교체 지점(서버 조회로)
├── components/      공통 UI
├── layouts/         법인 상단 내비, 감사 업무 프레임
└── pages/           화면(데이터 접근은 hooks·api만 사용)
```

실제 동작으로 확장하는 순서는 다음과 같습니다.

1. **백엔드**: `domain/types.ts`를 기준으로 DB 스키마와 REST/RPC API를 만듭니다. `domain/rules.ts`는 서버에서 그대로 실행합니다(감리 점검의 재현성 확보).
2. **교체**: `AuditApi`를 HTTP로 구현한 `httpApi`를 만들고 `api.ts` 마지막 줄을 바꿉니다. `hooks.ts`는 TanStack Query 같은 서버 조회로 바꾸고 시그니처는 그대로 둡니다. 화면 코드는 수정하지 않습니다.
3. **인증·권한**: 감사팀과 고객 포털 사용자를 분리하고, 업무 단위로 접근을 통제합니다.
4. **파일**: 국내 리전 저장소, 암호화, 변조 방지(해시)를 갖추고 감사조서 8년 보존을 지원합니다.
5. **연동**: 금융결제원·NICE 회신 파일 파서, Alphalyzer 결과 가져오기, OpenDART(전기 감사보고서)
6. **엑셀 애드인**: 조서 셀과 근거 연결을 Office.js 작업창으로 제공합니다. 무거운 처리는 로컬 엔진이 맡습니다.
7. **AI**: 선택형으로 둡니다. 비식별 데이터만 보내고 전송 로그를 남기며, 결론은 회계사가 확정합니다.

## 원칙 (프로젝트 공통)

- 회사 재무제표를 대신 작성하지 않습니다(외부감사법 제6조⑥). 이 도구는 감사인의 검증과 기록만 다룹니다.
- 감리 모의고사는 판단을 대신하지 않습니다. 기록이 빠졌는지만 점검합니다.
- 근거 규칙과 수치는 출처가 있는 것만 씁니다. 효과 수치는 파일럿에서 실측한 것만 씁니다.
