#!/usr/bin/env bash
# K-Tieout 데모 앱을 로컬에서 띄운다.
#   ./run.sh          데이터 생성부터 앱 빌드까지 전부 다시 하고 브라우저로 연다
#   ./run.sh --app    앱 화면만 다시 빌드해서 연다 (템플릿만 고쳤을 때)
set -euo pipefail
cd "$(dirname "$0")"

if [ ! -x .venv/bin/python ]; then
  python3 -m venv .venv
  .venv/bin/pip install -q openpyxl
fi
PY=.venv/bin/python

if [ "${1:-}" != "--app" ]; then
  $PY generate.py
  $PY ktieout.py > /dev/null
  $PY asis.py > /dev/null
  $PY compare.py > /dev/null
fi
$PY build_app.py

PORT="${PORT:-8765}"
URL="http://localhost:$PORT/K-Tieout_앱.html#list"
echo ""
echo "앱 주소: $URL   (종료: Ctrl+C)"
(sleep 1; open "$URL" 2>/dev/null || true) &
cd output && exec ../.venv/bin/python -m http.server "$PORT" --bind 127.0.0.1
