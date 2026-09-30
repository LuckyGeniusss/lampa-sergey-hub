#!/bin/bash
set -euo pipefail

BACKEND="${SERGEY_BACKEND:-http://10.129.1.174:18118}"
PLUGIN="https://luckygeniusss.github.io/lampa-sergey-hub/js"
TMP="$(mktemp)"
trap 'rm -f "$TMP"' EXIT

echo "== Backend =="
curl -fsS --max-time 5 "$BACKEND/version?type=hash"
echo

echo "== Search providers =="
PROVIDERS="$(curl -fsS --max-time 10 "$BACKEND/lite/withsearch")"
python3 -c 'import json,sys; a=json.loads(sys.argv[1]); print("count=",len(a)); print(", ".join(a))' "$PROVIDERS"

echo
echo "== Discovery: The Matrix =="
python3 - "$BACKEND" <<'PY'
import sys,time,json,urllib.parse,urllib.request
b=sys.argv[1]
p={'id':'603','tmdb_id':'603','title':'The Matrix','original_title':'The Matrix','serial':'0','year':'1999','source':'tmdb','rchtype':'apk','clarification':'0','similar':'false','original_language':''}
q=urllib.parse.urlencode(p)
def get(u):
    with urllib.request.urlopen(u,timeout=12) as f:return json.loads(f.read().decode())
j=get(b+'/lite/events?life=true&'+q); mem=j['memkey']; x={}
for _ in range(15):
    time.sleep(.5); x=get(b+'/lifeevents?memkey='+urllib.parse.quote(mem)+'&'+q)
    if x.get('ready'): break
online=x.get('online',[]); active=[i for i in online if i.get('show')]
print('discovered=',len(online),'active=',len(active))
print('active:',', '.join((i.get('balanser') or i.get('name','').split()[0]) for i in active))
if len(active)<3: raise SystemExit('FAIL: too few active sources')
PY

echo
echo "== GitHub Pages plugin =="
HTTP="$(curl -L -sS -o "$TMP" -w '%{http_code}' "$PLUGIN")"
echo "HTTP=$HTTP bytes=$(wc -c < "$TMP" | tr -d ' ')"
[ "$HTTP" = "200" ]
grep -q 'Lampa\.' "$TMP"
grep -q 'Sergey Online' "$TMP"
echo "PASS"
