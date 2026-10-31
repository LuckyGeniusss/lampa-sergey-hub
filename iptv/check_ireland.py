#!/usr/bin/env python3
"""Produce a verified, Ireland-origin TV-only M3U. No premium, UK or radio."""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed
import json, re, subprocess, shutil, time, collections, os, urllib.request
ROOT=Path(__file__).resolve().parent
QA=ROOT/'ireland-qa'
SRC=[
 ('iptv-ie.txt','https://iptv-org.github.io/iptv/countries/ie.m3u'),
 ('iptv-gle.txt','https://iptv-org.github.io/iptv/languages/gle.m3u'),
 ('iptv-org-ireland-streams.txt','https://raw.githubusercontent.com/iptv-org/iptv/master/streams/ie.m3u')
]
def parse_m3u(text, source):
    a=[]; meta=None;opts=[]
    for l in text.splitlines():
        l=l.strip()
        if l.startswith('#EXTINF'):meta=l;opts=[]
        elif l.startswith('#EXTVLCOPT') and meta:opts.append(l)
        elif l.startswith(('http://','https://')) and meta:
            a.append({'name':meta.split(',',1)[-1].strip(),'meta':meta,'opt':opts,'url':l,'source':source})
            meta=None;opts=[]
    return a

all_candidates=[]
for filename, origin in SRC:
    p=QA/filename
    req=urllib.request.Request(origin,headers={'User-Agent':'WazoTV Ireland QA'})
    try:
        raw=urllib.request.urlopen(req,timeout=20).read(2500000)
        p.parent.mkdir(parents=True,exist_ok=True)
        p.write_bytes(raw)
    except Exception as exc:
        if not p.is_file():raise
        print('Using cached upstream:',origin,str(exc),flush=True)
    for e in parse_m3u(p.read_text(),origin):
        name=e['name'].lower()
        if any(w in name for w in ['oireachtas','tg4','rtejr','rtéjr','rte news','rté news']):
            all_candidates.append(e)
# Additional links from Free-TV Ireland, including explicitly invalid entries.
# Only validated entries enter published playlist.
free_tv_url='https://raw.githubusercontent.com/Free-TV/IPTV/master/lists/ireland.md'
try:
    raw=urllib.request.urlopen(urllib.request.Request(free_tv_url,headers={'User-Agent':'WazoTV Ireland QA'}),timeout=20).read(300000).decode('utf8','replace')
    (QA/'free-tv-ie.txt').write_text(raw)
except Exception:
    raw=(QA/'free-tv-ie.txt').read_text() if (QA/'free-tv-ie.txt').is_file() else ''
section=''
for line in raw.splitlines():
    if line.startswith('<h2>'):section=line
    if not line.startswith('|') or '[>](' not in line:continue
    cells=[x.strip() for x in line.strip('|').split('|')]
    if len(cells)<3:continue
    name=cells[1]; m=re.search(r'\[>\]\((https?://[^)]+)\)',cells[2])
    if not m:continue
    if any(v in name.lower() for v in ['tg4','oireachtas','rté','rte','virgin media']):
        all_candidates.append({'name':name,'meta':'#EXTINF:-1,'+name,'opt':[],'url':m.group(1),'source':'Free-TV / Ireland ('+section+')'})
# Current direct publicly streamed parliamentary TV feed (replaces dead 2023 CloudFront).
all_candidates.append({
  'name':'Oireachtas TV',
  'meta':'#EXTINF:-1 tvg-id="OireachtasTV.ie",Oireachtas TV',
  'opt':[],
  'url':'https://oirtv.oireachtas.ie/hls_2.m3u8',
  'source':'Oireachtas direct broadcaster HLS'
})
# Exclude sports re-streams (including Setanta, Sky F1); keep only Irish broadcasters.
seen=set();candidates=[]
for e in all_candidates:
    if e['url'] in seen:continue
    seen.add(e['url']);candidates.append(e)
FFMPEG='/opt/homebrew/bin/ffmpeg' if Path('/opt/homebrew/bin/ffmpeg').exists() else shutil.which('ffmpeg')
assert FFMPEG,'ffmpeg missing'
def check(e):
    cmd=[FFMPEG,'-hide_banner','-nostdin','-loglevel','error','-rw_timeout','5000000','-analyzeduration','1600000','-probesize','180000']
    h=re.search(r'http-user-agent="([^"]+)"',e['meta'])
    if h:cmd.extend(['-user_agent',h.group(1)])
    cmd+=['-i',e['url'],'-map','0:v:0','-frames:v','10','-f','null','-']
    try:
        r=subprocess.run(cmd,capture_output=True,timeout=17)
        error=r.stderr.decode('utf8','replace')[-260:]
        return dict(e,ok=r.returncode==0,error=error if r.returncode else '')
    except Exception as ex:return dict(e,ok=False,error=str(ex)[:200])
results=[]
with ThreadPoolExecutor(max_workers=12) as pool:
    for fut in as_completed([pool.submit(check,e) for e in candidates]):
        r=fut.result();results.append(r)
        print('OK' if r['ok'] else 'FAIL',r['name'][:50],r['error'][-110:] if not r['ok'] else '',flush=True)
# Choose canonical name per real feed; avoid duplicate listings of same channel.
def canonical(n):
    s=n.lower()
    if 'oireachtas' in s:
        for k in range(1,5):
            if 'room '+str(k) in s or 'cr '+str(k) in s:return 'Oireachtas - Committee Room '+str(k)
        if 'dail' in s or 'dáil' in s:return 'Oireachtas - Dáil Éireann'
        if 'seanad' in s:return 'Oireachtas - Seanad Éireann'
        return 'Oireachtas TV'
    if 'tg4' in s:return 'TG4'
    if 'rtejr' in s or 'rtéjr' in s:return 'RTÉjr'
    if 'rte news' in s or 'rté news' in s:return 'RTÉ News'
    if 'rté one' in s or 'rte one' in s:return 'RTÉ One'
    if 'rté2' in s or 'rte2' in s:return 'RTÉ2'
    if 'virgin media' in s:
        for num in ('1','2','3','4'):
            if num in s or ['one','two','three','four'][int(num)-1] in s:return 'Virgin Media '+num
    return n
best={}
for e in results:
    if not e['ok']:continue
    key=canonical(e['name'])
    # Prefer stable streams from official oireachtas/brightcove hosts over other variants
    pri=3 if any(x in e['url'] for x in ['oireachtas','heanet.ie','cloudfront.net/el/live/oirtv','brightcove']) else 1
    if key not in best or pri>best[key][0]:best[key]=(pri,e)
order={'TG4':0,'RTÉ One':1,'RTÉ2':2,'RTÉ News':3,'RTÉjr':4,'Virgin Media 1':5,'Virgin Media 2':6,'Virgin Media 3':7,'Virgin Media 4':8,'Oireachtas TV':9}
items=sorted([(name,v[1]) for name,v in best.items()],key=lambda x:(order.get(x[0],20),x[0]))
if len(items)<1:raise SystemExit('Guard: no working Irish TV streams. Retain existing file')
out=['#EXTM3U']
for name,e in items:
    tid=re.search(r'tvg-id="([^"]+)"',e['meta'])
    logo=re.search(r'tvg-logo="([^"]+)"',e['meta'])
    inf='#EXTINF:-1'+(' tvg-id="'+tid.group(1)+'"' if tid else '')+(' tvg-logo="'+logo.group(1)+'"' if logo else '')+' group-title="Ирландские каналы",'+name
    out.extend([inf]+e['opt']+[e['url']])
(ROOT/'wazo_ireland.m3u').write_text('\n'.join(out)+'\n',encoding='utf8')
report={'time_utc':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),'candidates':len(candidates),'verified':len(items),'channels':[{'name':name,'origin':e['source'],'url':e['url']} for name,e in items],'failed':[{'name':e['name'],'reason':e['error'][-140:]} for e in results if not e['ok']]}
(ROOT/'wazo_ireland_status.json').write_text(json.dumps(report,indent=2,ensure_ascii=False)+'\n')
print('FINAL',len(items),[name for name,_ in items],flush=True)
