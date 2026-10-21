# K-Tieout 데모 (매출·매출채권, 더미 데이터)

샘플제조(주) 2025년 결산 자료를 실무 양식대로 만들고, 같은 자료를 두 방식으로 감사해 비교한다.

- **As-Is**: 표본 기반 조서 (감사마스터 조서 4000C-1·4000C-2·5050·5051·4000C-3·4000P-2·4000P-5·4000P-10)
- **K-Tieout**: 원장 × 홈택스 매출 전자세금계산서 × 은행 입금 3방향 전수대사

앱 템플릿: `page/app_template.html` (데이터는 `build_app.py`가 끼워 넣음)

## 앱 화면 보기 (로컬)

```bash
cd poc
./run.sh          # 데이터 생성 → 대사 → 조서 → 앱 빌드 후 브라우저로 http://localhost:8765 열기
./run.sh --app    # 화면(page/app_template.html)만 고쳤을 때 빠르게 다시 빌드
```

종료는 Ctrl+C. 서버 없이 `output/K-Tieout_앱.html`을 브라우저로 바로 열어도 된다.
화면: 감사 목록 → 대시보드 → 자료 요청 → 조서(지금 방식/K-Tieout 전환) → 검토 필요 → 비교 리포트.

## 단계별 실행

```bash
cd poc
python3 -m venv .venv && .venv/bin/pip install openpyxl
.venv/bin/python generate.py    # data/company/*.xlsx, data/truth.json (이상 거래 정답지)
.venv/bin/python ktieout.py     # output/to-be/  (정답지를 읽지 않음)
.venv/bin/python asis.py        # output/as-is/
.venv/bin/python compare.py     # output/비교_As-Is_vs_K-Tieout.xlsx, output/metrics.json
.venv/bin/python build_app.py   # output/K-Tieout_앱.html
```

## 형식 근거와 신뢰도

| 자료 | 근거 | 신뢰도 |
| --- | --- | --- |
| 홈택스 매출 전자세금계산서 목록 (33열, 1행 회사·3행 총계·5행 띠·6행 머리글, `품목` 시트) | 실물 파일 실측 기록: github.com/rrangjaa-eng/ERP_PLANT8_260917 `.planning/phases/06.1-evidence-bulk-intake/samples/` | 높음 (값 표기 `전자세금계산서종류`·`발급유형`은 추정) |
| 은행 거래내역 (KB국민: 거래일시·적요·기재내용·찾으신금액·맡기신금액·잔액·거래점) | 은행별 실측 헤더 정리: github.com/guddlslee98/management_money `src/features/import/FORMATS.md` | 높음 (법인 뱅킹은 다를 수 있음) |
| 감사조서 번호·항목 | 중소회계법인협의회 감사마스터 화면을 본뜬 저장소: github.com/Choi-wooin/kiwi `pages/`, `pages/docs/` | 중~높음 |
| 더존 분개장·계정별원장·거래처원장·시산표 | 공개 원문 미확보, 일반 구조로 작성 | 추정 |
| 부가세 신고서 | 숫자만 표로 단순화 | 낮음 |

## 심어 둔 이상 거래 (data/truth.json)

A1 가공매출 의심 · A2 세금계산서 미발행 · A3 매출 누락(가수금) · A4 금액 전치 · A5 반품 수정세금계산서 미반영 ·
A6 기간귀속 과대 · A7 기간귀속 과소 · A8 기말 직전 매출 후속 반품 · A9 제3자 명의 입금 · A10 원장 중복 계상 · A11 장기 미회수

## 주의

- 엔진은 이 데이터로 다듬었다. 실데이터에서는 11/11·오탐 0이 그대로 나오지 않는다.
- 작업량 계산기의 분 단위는 가정치다. 효과 수치는 파일럿 실측으로만 쓴다.
- As-Is는 단순화했다 (연령분석 4000C-4, 후속기간 반품 검토 등 미포함).
