"""백오피스 프로토타입(output/K-Tieout_앱.html)용 데이터를 모아 템플릿에 넣는다.

입력: output/as-is, output/to-be 조서 엑셀, output/metrics.json, ktieout.run() 결과(증빙 3종 대조용)
"""
import json
from collections import Counter

from openpyxl import load_workbook

import ktieout
from common import COMPANY_DIR, OUT, ROOT, d2s

FILL = {"DDE4EE": "h", "F2F2F2": "b", "FDE2E1": "f", "FFF4CC": "w", "E3F2E6": "o"}


def fmt(v):
    if v is None:
        return ""
    if isinstance(v, bool):
        return str(v)
    if isinstance(v, (int, float)):
        return f"{v:,.0f}" if abs(v) >= 1000 or float(v).is_integer() else f"{v:,.2f}"
    return str(v)


def dump_sheet(ws, skip_head=5):
    """조서 머리(1~5행)는 따로 읽고, 나머지 행을 값·서식 구분과 함께 내보낸다."""
    head = [ws.cell(r, 1).value for r in range(1, 5)]
    rows = []
    for row in ws.iter_rows(min_row=skip_head + 1):
        vals = [fmt(c.value) for c in row]
        while vals and vals[-1] == "":
            vals.pop()
        if not vals:
            rows.append({"c": [], "k": ""})
            continue
        k = ""
        for c in row:
            rgb = (c.fill.fgColor.rgb or "")[-6:] if c.fill and c.fill.fill_type == "solid" else ""
            if rgb in FILL:
                k = FILL[rgb]
                break
        if not k and row[0].font and row[0].font.bold:
            k = "t"
        rows.append({"c": vals, "k": k})
    while rows and not rows[-1]["c"]:
        rows.pop()
    return {"title": head[0] or ws.title, "meta": [h for h in head[1:] if h], "rows": rows}


def main():
    m = json.loads((OUT / "metrics.json").read_text())
    asis_wb = load_workbook(OUT / "as-is" / "As-Is_조서_샘플제조_2025.xlsx")
    tobe_wb = load_workbook(OUT / "to-be" / "K-Tieout_결과_샘플제조_2025.xlsx")
    sheets = {}
    for ws in asis_wb.worksheets:
        sheets["asis:" + ws.title] = dump_sheet(ws)
    for ws in tobe_wb.worksheets:
        sheets["tobe:" + ws.title] = dump_sheet(ws)

    # 증빙 3종 나란히 보기
    res = ktieout.run()
    sales = {s["id"]: s for s in res["sales"]}
    inv = {i["appr"]: i for i in res["inv"]}
    deps = {d["id"]: d for d in res["deps"]}
    items = {it["key"]: it for it in res["items"]}
    custs = res["custs"]
    evidence = {}
    for x in res["exceptions"]:
        s = sales.get(x["ledger"])
        i = inv.get(x["appr"])
        if s and not i and s.get("inv"):
            i = inv.get(s["inv"])
        if i and not s and i.get("ledger"):
            s = sales.get(i["ledger"])
        dep_ids = []
        if x["deposit"]:
            dep_ids = [d.strip() for d in x["deposit"].split(",")]
        else:
            it = items.get(x["appr"]) or items.get(x["ledger"]) or (items.get(s["inv"]) if s and s.get("inv") else None)
            if it:
                dep_ids = it["deps"]
        orig = inv.get(i["orig"]) if i and i.get("orig") else None
        evidence[x["no"]] = {
            "ledger": s and {"date": d2s(s["date"]), "no": s["no"], "cust": custs[s["cust"]]["name"], "total": s["total"],
                             "supply": s["supply"], "memo": s["memo"]},
            "invoice": i and {"appr": i["appr"], "wdate": d2s(i["wdate"]), "idate": d2s(i["idate"]), "name": i["name"],
                              "bizno": i["bizno"], "total": i["total"], "supply": i["supply"], "kind": i["kind"],
                              "item": i["item"], "orig": orig and {"appr": orig["appr"], "wdate": d2s(orig["wdate"]),
                                                                   "total": orig["total"]}},
            "deposits": [{"id": d, "dt": f"{deps[d]['dt']:%Y-%m-%d %H:%M}", "memo": deps[d]["memo"], "amount": deps[d]["in"],
                          "rule": deps[d]["rule"]} for d in dep_ids if d in deps],
        }

    # 2025 원장 매출 건별 상태 (대시보드 도넛)
    status = Counter()
    ex_ledgers = {x["ledger"] for x in res["exceptions"] if x["ledger"]}
    ex_apprs = {x["appr"] for x in res["exceptions"] if x["appr"]}
    for s in res["sales"]:
        if s["date"].year != 2025:
            continue
        it = items.get(s["inv"]) if s["inv"] else items.get(s["id"])
        if s["id"] in ex_ledgers or (s["inv"] and s["inv"] in ex_apprs):
            status["검토 필요"] += 1
        elif it and it["paid"] >= it["amt"] - ktieout.FEE_TOL:
            status["3방향 일치"] += 1
        else:
            status["입금 대기 (만기 전)"] += 1

    def preview(fname, sheet=None, head_row=1, n=8):
        ws = load_workbook(COMPANY_DIR / fname)[sheet] if sheet else load_workbook(COMPANY_DIR / fname).active
        top = [" · ".join(fmt(c) for c in r if c is not None)
               for r in ws.iter_rows(min_row=1, max_row=head_row - 1, values_only=True)]
        rows = [[fmt(c) for c in r] for r in ws.iter_rows(min_row=head_row, max_row=head_row + n, values_only=True)]
        return {"meta": [t for t in top if t], "head": rows[0], "rows": rows[1:], "total": ws.max_row - head_row}

    pbc = [
        ["PBC-001", "공통", "합계잔액시산표", "01_합계잔액시산표_2025.xlsx", "재무팀", "2026-02-09", "검토완료", "", preview("01_합계잔액시산표_2025.xlsx", head_row=5)],
        ["PBC-002", "공통", "분개장 (2025년 전체)", "02_분개장_2025.xlsx", "재무팀", "2026-02-09", "검토완료", "K-Tieout 입력", preview("02_분개장_2025.xlsx", head_row=5)],
        ["PBC-003", "공통", "분개장 (2026년 1~2월, 후속기간)", "03_분개장_2026_1-2월.xlsx", "재무팀", "2026-03-04", "검토완료", "K-Tieout 입력", preview("03_분개장_2026_1-2월.xlsx", head_row=5)],
        ["PBC-004", "매출채권", "계정별원장 (외상매출금)", "04_계정별원장_외상매출금_2025.xlsx", "재무팀", "2026-02-09", "검토완료", "", preview("04_계정별원장_외상매출금_2025.xlsx", head_row=5)],
        ["PBC-005", "매출채권", "거래처원장 (잔액)", "05_거래처원장_외상매출금_2025.xlsx", "영업관리팀", "2026-02-09", "검토완료", "K-Tieout 입력", preview("05_거래처원장_외상매출금_2025.xlsx", head_row=5)],
        ["PBC-006", "공통", "거래처등록현황", "06_거래처등록현황.xlsx", "재무팀", "2026-02-09", "검토완료", "K-Tieout 입력", preview("06_거래처등록현황.xlsx", head_row=3)],
        ["PBC-007", "매출", "홈택스 매출 전자세금계산서 목록 (2025)", "07_매출전자세금계산서목록_2025.xlsx", "재무팀", "2026-02-10", "검토완료", "K-Tieout 입력", preview("07_매출전자세금계산서목록_2025.xlsx", "세금계산서", head_row=6)],
        ["PBC-008", "매출", "홈택스 매출 전자세금계산서 목록 (2026년 1~2월)", "08_매출전자세금계산서목록_2026_1-2월.xlsx", "재무팀", "2026-03-04", "검토완료", "K-Tieout 입력", preview("08_매출전자세금계산서목록_2026_1-2월.xlsx", "세금계산서", head_row=6)],
        ["PBC-009", "현금", "은행 거래내역 (보통예금)", "09_은행거래내역_KB국민_보통예금.xlsx", "자금팀", "2026-03-04", "검토완료", "K-Tieout 입력", preview("09_은행거래내역_KB국민_보통예금.xlsx", head_row=6)],
        ["PBC-010", "세무", "부가가치세 신고서 (과세표준)", "10_부가가치세신고서_과세표준요약_2025.xlsx", "세무팀", "2026-02-12", "검토완료", "", preview("10_부가가치세신고서_과세표준요약_2025.xlsx", head_row=3)],
        ["PBC-011", "현금", "은행 잔액증명서", "", "자금팀", "2026-02-10", "요청중", "", None],
        ["PBC-012", "재고", "기말 재고수불부·실사자료", "", "생산관리팀", "2026-02-11", "요청중", "", None],
        ["PBC-013", "매입채무", "거래처별 매입채무 명세", "", "재무팀", "2026-02-11", "제출지연", "", None],
        ["PBC-014", "인사", "급여대장·4대보험 내역", "", "인사팀", "2026-02-12", "요청중", "", None],
        ["PBC-015", "공통", "주요 계약서 및 이사회 의사록", "", "경영지원팀", "2026-02-12", "요청중", "", None],
    ]

    keep = ["anomalies", "mus_interval", "false_positives", "asis_counts", "tobe_counts", "coverage", "asis_coverage",
            "asis_effort", "tobe_effort", "rules", "vat", "asis_vat_diff", "confirm", "exceptions", "asis_findings"]
    data = {k: m[k] for k in keep}
    data.update({"sheets": sheets, "evidence": evidence, "status": dict(status), "pbc": pbc,
                 "ledger_bal_total": sum(p["ledger"] for p in res["per"])})
    js = json.dumps(data, ensure_ascii=False, default=str).replace("</", "<\\/")
    tpl = (ROOT / "page" / "app_template.html").read_text().replace("/*DATA*/null", js)
    cut = tpl.index('<div class="app')
    html = ("<!doctype html>\n<html lang=\"ko\">\n<head>\n<meta charset=\"utf-8\">\n"
            "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1,viewport-fit=cover\">\n"
            + tpl[:cut] + "</head>\n<body>\n" + tpl[cut:] + "\n</body>\n</html>\n")
    path = OUT / "K-Tieout_앱.html"
    path.write_text(html)
    print(path, f"{len(html):,} bytes", dict(status))


if __name__ == "__main__":
    main()
