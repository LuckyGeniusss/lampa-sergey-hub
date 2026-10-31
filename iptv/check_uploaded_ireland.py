#!/usr/bin/env python3
"""Check every entry in user's Ireland IPTV M3U by decoding 8 video frames."""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed
import json, subprocess, shutil, re, time, urllib.request
ROOT=Path(__file__).resolve().parent
p=ROOT/'sources/ie-uploaded-20261031.m3u'
if not p.is_file():
    p.parent.mkdir(parents=True,exist_ok=True)
    req=urllib.request.Request('https://iptv-org.github.io/iptv/countries/ie.m3u',
                                headers={'User-Agent':'WazoTV QA'})
    p.write_bytes(urllib.request.urlopen(req,timeout=20).read(2000000))
entries=[]
meta=None;options=[]
for l in p.read_text(encoding='utf-8-sig').splitlines():
    l=l.strip()
    if l.startswith('#EXTINF:'):meta=l;options=[]
    elif l.startswith('#') and meta:options.append(l)
    elif l.startswith(('https://','http://')) and meta:
        entries.append({'meta':meta,'url':l,'name':meta.rsplit(',',1)[-1], 'options':options})
        meta=None
assert len(entries)==59,(len(entries),p)
ffmpeg='/opt/homebrew/bin/ffmpeg' if Path('/opt/homebrew/bin/ffmpeg').exists() else shutil.which('ffmpeg')
def probe(e):
    cmd=[ffmpeg,'-nostdin','-hide_banner','-loglevel','error','-rw_timeout','4500000','-analyzeduration','1200000','-probesize','131072']
    agent=re.search(r'http-user-agent="([^"]+)"',e['meta'])
    if agent:cmd+=['-user_agent',agent.group(1)]
    cmd+=['-i',e['url'],'-map','0:v:0','-frames:v','8','-f','null','-']
    try:
        res=subprocess.run(cmd,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE,timeout=14)
        return dict(e,ok=(res.returncode==0),message=res.stderr.decode('utf8','replace')[-230:] if res.returncode else '')
    except Exception as ex:
        return dict(e,ok=False,message=str(ex)[:230])
start=time.time()
results=[]
with ThreadPoolExecutor(max_workers=12) as pool:
    for fut in as_completed([pool.submit(probe,e) for e in entries]):
        r=fut.result()
        results.append(r)
        print('PASS' if r['ok'] else 'FAIL',r['name'],r['message'][-75:].replace('\n',' '),flush=True)
report={'source':'User uploaded ie-iptv-playlist.m3u (same 59 URLs as cached IPTV-org Ireland 2026-10-31)', 'checked_at_utc':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()), 'total':len(entries), 'working':sum(e['ok'] for e in results),'seconds':round(time.time()-start),'results':sorted(results,key=lambda e:e['name'])}
(ROOT/'uploaded_ireland_qa.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print('SUMMARY',report['total'],report['working'],report['seconds'],flush=True)
