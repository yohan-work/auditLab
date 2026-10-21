"""wiki/*.md 노트를 읽어 뷰어 한 장(wiki/_site/viewer.html)으로 묶는다.

사용: python3 wiki/_site/build.py
- 노트 형식은 wiki/README.md 참고
- 깨진 [[링크]]가 있으면 목록을 출력하고 종료 코드 1
"""
import hashlib
import json
import re
import sys
from pathlib import Path

WIKI = Path(__file__).resolve().parent.parent
SITE = WIKI / "_site"
FOLDERS = ["안내", "개념", "절차", "법령", "주체", "기준·서식"]
GRADES = ["법률", "시행령·규정", "기준", "감독기관", "관행", "확인 필요"]
LINK = re.compile(r"\[\[([^\]]+)\]\]")


def nid(title):
    return "n" + hashlib.sha1(title.encode()).hexdigest()[:8]


def parse(path):
    raw = path.read_text(encoding="utf-8")
    m = re.match(r"---\n(.*?)\n---\n(.*)", raw, re.S)
    if not m:
        raise ValueError(f"frontmatter 없음: {path}")
    fm_txt, body = m.groups()
    fm, key = {}, None
    for line in fm_txt.splitlines():
        if line.startswith("  - ") and key:
            label, _, url = line[4:].partition(" | ")
            fm[key].append({"label": label.strip(), "url": url.strip()})
        elif ":" in line:
            key, _, val = line.partition(":")
            key, val = key.strip(), val.strip()
            if val.startswith("["):
                fm[key] = [a.strip() for a in val.strip("[]").split(",") if a.strip()]
            elif val == "":
                fm[key] = []
            else:
                fm[key] = val
    parts = re.split(r"^## (.+)$", body, flags=re.M)
    intro, sections, facts, checks = parts[0].strip(), [], [], []
    for name, text in zip(parts[1::2], parts[2::2]):
        name, text = name.strip(), text.strip()
        if name == "사실":
            for line in text.splitlines():
                if not line.startswith("- "):
                    continue
                cells = [c.strip() for c in line[2:].split(" | ")]
                if len(cells) != 3 or cells[2] not in GRADES:
                    raise ValueError(f"사실 줄 형식 오류 ({path.name}): {line}")
                facts.append({"text": cells[0], "src": cells[1], "grade": cells[2]})
        elif name == "확인 필요":
            checks += [l[2:].strip() for l in text.splitlines() if l.startswith("- ")]
        else:
            sections.append({"name": name, "text": text})
    return {
        "title": fm["title"],
        "type": fm.get("type", path.parent.name),
        "aliases": fm.get("aliases", []),
        "status": fm.get("status", "kb"),
        "verified": fm.get("verified", ""),
        "sources": fm.get("sources", []),
        "intro": intro,
        "facts": facts,
        "sections": sections,
        "checks": checks,
        "file": str(path.relative_to(WIKI)),
    }


def sort_key(n):
    t = n["title"]
    nums = [int(x) for x in re.findall(r"\d+", t)] + [0, 0]
    return (re.sub(r"\s*제?\d.*", "", t), nums[0], nums[1], t)


def main():
    notes = []
    for folder in FOLDERS:
        d = WIKI / folder
        if d.is_dir():
            notes += [parse(p) for p in sorted(d.glob("*.md"))]
    by_name = {}
    for n in notes:
        n["id"] = nid(n["title"])
        for name in [n["title"], *n["aliases"]]:
            by_name.setdefault(name, n["id"])

    # 가상 노트: 확인 필요 목록 (빌드 때 모음), 위키에 없는 질문 (뷰어가 db에서 채움)
    virtual = [
        {"title": "확인 필요 목록", "type": "안내", "aliases": ["확인 필요"], "status": "virtual"},
        {"title": "위키에 없는 질문", "type": "안내", "aliases": ["빈칸 목록"], "status": "virtual"},
    ]
    for v in virtual:
        v.update(id=nid(v["title"]), intro="", facts=[], sections=[], checks=[], sources=[], verified="", file="")
        for name in [v["title"], *v["aliases"]]:
            by_name.setdefault(name, v["id"])

    broken = []
    for n in notes:
        text = " ".join([n["intro"], *[s["text"] for s in n["sections"]], *[f["text"] for f in n["facts"]], *n["checks"]])
        out = []
        for target in LINK.findall(text):
            if target in by_name:
                out.append(by_name[target])
            else:
                broken.append((n["file"], target))
        n["links"] = list(dict.fromkeys(out))
        n["grades"] = [g for g in GRADES if any(f["grade"] == g for f in n["facts"])]
    back = {}
    for n in notes:
        for t in n["links"]:
            back.setdefault(t, []).append(n["id"])
    for n in notes + virtual:
        n["backlinks"] = back.get(n["id"], [])

    open_items = []
    for n in notes:
        for c in n["checks"]:
            open_items.append({"note": n["id"], "text": c})
        for f in n["facts"]:
            if f["grade"] == "확인 필요":
                open_items.append({"note": n["id"], "text": f["text"] + " (" + f["src"] + ")"})
    virtual[0]["links"] = list(dict.fromkeys(i["note"] for i in open_items))
    virtual[1]["links"] = []

    notes.sort(key=lambda n: (FOLDERS.index(n["type"]) if n["type"] in FOLDERS else 99, sort_key(n)))
    data = {
        "notes": virtual + notes,
        "names": by_name,
        "folders": FOLDERS,
        "grades": GRADES,
        "openItems": open_items,
        "built": __import__("datetime").date.today().isoformat(),
    }
    payload = json.dumps(data, ensure_ascii=False).replace("</", "<\\/")
    tpl = (SITE / "template.html").read_text(encoding="utf-8")
    (SITE / "viewer.html").write_text(tpl.replace("/*__WIKI_DATA__*/null", payload), encoding="utf-8")

    counts = {s: sum(1 for n in notes if n["status"] == s) for s in ("verified", "kb", "check")}
    print(f"노트 {len(notes)}개 · 원문 대조 {counts['verified']} · v3.0 {counts['kb']} · 확인 필요 {counts['check']} · 확인 항목 {len(open_items)}")
    if broken:
        print("깨진 링크:")
        for f, t in broken:
            print(f"  {f}: [[{t}]]")
        sys.exit(1)


if __name__ == "__main__":
    main()
