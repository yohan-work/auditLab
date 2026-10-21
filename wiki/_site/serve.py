"""위키 뷰어를 로컬에서 띄운다.

사용: python3 wiki/_site/serve.py [포트]   (기본 8787) → http://127.0.0.1:8787
- 페이지를 열 때마다 노트를 다시 빌드한다 (build.py)
- 질문은 로컬 Claude Code(`claude -p`)로 답한다. 도구·MCP는 끈다.
- 위키에 없는 질문은 wiki/_site/gaps.json에 쌓인다.
"""
import json
import shutil
import subprocess
import sys
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

SITE = Path(__file__).resolve().parent
GAPS = SITE / "gaps.json"
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8787
CLAUDE = shutil.which("claude")
SKELETON = ('<!doctype html><html lang="ko"><head><meta charset="utf-8">'
            '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
            "<style>body{margin:0}[hidden]{display:none!important}</style></head><body>{page}</body></html>")


def load_gaps():
    try:
        return json.loads(GAPS.read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError):
        return []


class Handler(BaseHTTPRequestHandler):
    def send(self, code, body, ctype="application/json; charset=utf-8"):
        data = body.encode() if isinstance(body, str) else body
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(data)

    def body(self):
        n = int(self.headers.get("Content-Length") or 0)
        return json.loads(self.rfile.read(n) or b"{}")

    def do_GET(self):
        path = self.path.split("?")[0]
        if path in ("/", "/index.html"):
            built = subprocess.run([sys.executable, str(SITE / "build.py")], capture_output=True, text=True)
            if built.returncode != 0:
                return self.send(500, "<pre>빌드 실패\n" + built.stdout + built.stderr + "</pre>", "text/html; charset=utf-8")
            page = (SITE / "viewer.html").read_text(encoding="utf-8")
            return self.send(200, SKELETON.replace("{page}", page), "text/html; charset=utf-8")
        if path == "/api/health":
            return self.send(200, json.dumps({"ok": True, "claude": bool(CLAUDE)}))
        if path == "/api/gaps":
            return self.send(200, json.dumps([g for g in load_gaps() if g.get("status") == "open"], ensure_ascii=False))
        self.send(404, '{"error":"not_found"}')

    def do_POST(self):
        if self.path == "/api/ask":
            if not CLAUDE:
                return self.send(503, json.dumps({"code": "no_claude", "message": "claude CLI를 찾을 수 없어요"}))
            prompt = self.body().get("prompt", "")
            try:
                r = subprocess.run(
                    [CLAUDE, "-p", "--tools", "", "--strict-mcp-config", "--no-session-persistence", "--output-format", "text"],
                    input=prompt, capture_output=True, text=True, timeout=180, cwd=SITE,
                )
            except subprocess.TimeoutExpired:
                return self.send(504, json.dumps({"code": "timeout", "message": "답이 3분 안에 오지 않았어요"}))
            if r.returncode != 0:
                return self.send(502, json.dumps({"code": "upstream_error", "message": (r.stderr or r.stdout)[-500:]}, ensure_ascii=False))
            return self.send(200, json.dumps({"text": r.stdout.strip()}, ensure_ascii=False))
        if self.path == "/api/gaps":
            b = self.body()
            gaps = load_gaps()
            gaps.append({"question": b.get("question", ""), "gap": b.get("gap", ""), "at": int(time.time() * 1000), "status": "open"})
            GAPS.write_text(json.dumps(gaps, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
            return self.send(200, '{"ok":true}')
        self.send(404, '{"error":"not_found"}')

    def log_message(self, fmt, *args):
        pass


if __name__ == "__main__":
    print(f"auditLab Wiki: http://127.0.0.1:{PORT}  (끄려면 Ctrl+C)")
    if not CLAUDE:
        print("주의: claude CLI가 없어 질문 기능은 꺼져요")
    ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
