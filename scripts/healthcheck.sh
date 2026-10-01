#!/bin/bash
set -euo pipefail

BACKEND="${SERGEY_BACKEND:-https://sergey-online-backend.onrender.com}"
PLUGIN="${SERGEY_PLUGIN:-https://luckygeniusss.github.io/lampa-sergey-hub/js}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TMP="$(mktemp)"
trap 'rm -f "$TMP"' EXIT

cd "$ROOT"

echo "== Sergey Online cloud regression =="
npm run test:cloud

echo
echo "== Public GitHub Pages plugin =="
HTTP="$(curl -L -sS --max-time 15 -o "$TMP" -w '%{http_code}' "$PLUGIN")"
echo "HTTP=$HTTP bytes=$(wc -c < "$TMP" | tr -d ' ')"
[ "$HTTP" = "200" ]
grep -q 'Sergey Online 1.3.0' "$TMP"
grep -q 'Lampa\.' "$TMP"
echo "PUBLIC PLUGIN PASS"

echo
echo "== Backend HTTPS =="
curl -fsS --max-time 30 "$BACKEND/version?type=hash"
echo
curl -fsS --max-time 30 "$BACKEND/lite/withsearch" | python3 -c 'import json,sys; a=json.load(sys.stdin); print("configured_sources=",len(a)); assert len(a)>=70'

echo
echo "HEALTHCHECK PASS"
