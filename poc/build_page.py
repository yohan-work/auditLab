"""metrics.json을 데모 페이지 템플릿에 넣어 output/K-Tieout_데모.html을 만든다."""
import json

from common import OUT, ROOT

m = json.loads((OUT / "metrics.json").read_text())
m["files"] = [str(p) for p in sorted((ROOT / "data" / "company").glob("*.xlsx"))] + [
    str(OUT / "as-is" / "As-Is_조서_샘플제조_2025.xlsx"),
    str(OUT / "to-be" / "K-Tieout_결과_샘플제조_2025.xlsx"),
    str(OUT / "비교_As-Is_vs_K-Tieout.xlsx"),
]
keep = ["anomalies", "mus_interval", "false_positives", "asis_counts", "tobe_counts", "coverage", "asis_effort",
        "asis_findings", "asis_coverage", "tobe_effort", "rules", "vat", "asis_vat_diff", "confirm", "exceptions",
        "previews", "files"]
data = json.dumps({k: m[k] for k in keep}, ensure_ascii=False, default=str).replace("</", "<\\/")
html = (ROOT / "page" / "template.html").read_text().replace("/*DATA*/null", data)
(OUT / "K-Tieout_데모.html").write_text(html)
print(OUT / "K-Tieout_데모.html", len(html))
