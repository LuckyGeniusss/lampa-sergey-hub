#!/usr/bin/env python3
"""Screen high-value new channels in the global IPTV-org index (bounded QA)."""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor,as_completed
from urllib.parse import urlsplit
import os, re, hashlib, subprocess, json, time, urllib.request
from collections import Counter
ROOT=Path(__file__).resolve().parent
import sys
sys.path.insert(0,str(ROOT))
from curate_unified import from_file
base=from_file(ROOT/'wazo_tv.m3u')
index_path=ROOT/'index-qa/index.m3u'
if not index_path.is_file():
 index_path.parent.mkdir(parents=True,exist_ok=True)
 req=urllib.request.Request('https://iptv-org.github.io/iptv/index.m3u',
                              headers={'User-Agent':'WazoTV Index QA'})
 index_path.write_bytes(urllib.request.urlopen(req,timeout=50).read(6000000))
source=from_file(index_path)
current_urls={e['url'] for e in base}
def channel_id(e):
 m=re.search(r'tvg-id="([^"]*)"',e['meta'],re.I)
 return m.group(1).split('@')[0].casefold() if m else ''
current_ids={channel_id(e) for e in base if channel_id(e)}
new=[e for e in source if e['url'] not in current_urls and channel_id(e) not in current_ids]
seen=set(); filtered=[]
for e in new:
 host=urlsplit(e['url']).hostname
 if not host or host.lower() in ('127.0.0.1','localhost','0.0.0.0') or host.endswith('.local'):continue
 ident=channel_id(e) or e['url']
 if ident in seen:continue
 seen.add(ident);filtered.append(e)
# A bounded and deterministic set, representative of requested groups.
limits={'UA':65,'IE':30,'Kids':145,'Movies':145,'Series':145,'Documentary':115,
        'News':70,'Music':55,'Sports':45,'Education':35,'Other':15}
def group(e):
 m=re.search(r'group-title="([^"]*)"',e['meta'],re.I)
 g=(m.group(1) if m else '').casefold().split(';')
 tid=channel_id(e)
 if tid.endswith('.ua'):return 'UA'
 if tid.endswith('.ie'):return 'IE'
 for category,terms in [
  ('Kids',('kids','animation','family')),
  ('Movies',('movies','classic')),
  ('Series',('series',)),
  ('Documentary',('documentary','science')),
  ('News',('news',)),
  ('Music',('music',)),
  ('Sports',('sports',)),
  ('Education',('education','culture'))]:
  if any(term in g for term in terms):return category
 return 'Other'
buckets={k:[] for k in limits}
for e in filtered:buckets[group(e)].append(e)
chosen=[]
for g,limit in limits.items():
 # Distribution across the alphabet/countries and CDNs, reproducible.
 sample=sorted(buckets[g],key=lambda e: hashlib.md5((channel_id(e)+e['url']).encode()).hexdigest())[:limit]
 for e in sample:e['candidate_group']=g
 chosen+=sample
print('CANDIDATES',len(source),'UNIQUE NEW IDs',len(filtered),
      'TEST SAMPLE',len(chosen),
      'BUCKETS', {k:(len(buckets[k]),len([e for e in chosen if e['candidate_group']==k])) for k in limits},flush=True)
ffmpeg='/opt/homebrew/bin/ffmpeg' if Path('/opt/homebrew/bin/ffmpeg').exists() else 'ffmpeg'
def probe(e):
 cmd=[ffmpeg,'-hide_banner','-nostdin','-loglevel','error','-rw_timeout','4600000','-analyzeduration','800000','-probesize','98304']
 m=re.search(r'http-user-agent="([^"]+)"',e['meta'])
 if m:cmd.extend(['-user_agent',m.group(1)])
 ref=re.search(r'http-referrer="([^"]+)"',e['meta'])
 if ref:cmd.extend(['-referer',ref.group(1)])
 cmd+=['-i',e['url'],'-map','0:v:0','-frames:v','8','-f','null','-']
 try:
  r=subprocess.run(cmd,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE,timeout=12)
  return dict(e,ok=r.returncode==0,error=r.stderr.decode('utf8','replace')[-160:] if r.returncode else '')
 except Exception as x:return dict(e,ok=False,error=str(x)[:170])
t0=time.time();passed=[];failed=[]
with ThreadPoolExecutor(max_workers=24) as workers:
 pending={workers.submit(probe,e):e for e in chosen}
 for i,f in enumerate(as_completed(pending),1):
  e=f.result()
  (passed if e['ok'] else failed).append(e)
  if i%80==0:print('PROGRESS',i,'/',len(chosen),'passed',len(passed),'seconds',int(time.time()-t0),flush=True)
result={'source':'https://iptv-org.github.io/iptv/index.m3u','downloaded_unique':len(source),
        'already_by_url':len({e['url'] for e in source}&current_urls),
        'screened_unique_by_channel_id':len(filtered),
        'tested':len(chosen),'passed':len(passed),'elapsed_seconds':int(time.time()-t0),
        'by_group_tested':dict(Counter(e['candidate_group'] for e in chosen)),
        'by_group_passed':dict(Counter(e['candidate_group'] for e in passed)),
        'streams':[{k:e[k] for k in ('name','meta','url','options','candidate_group')} for e in passed],
        'failed_sample':[{'name':e['name'],'url':e['url'],'error':e['error'][-100:]} for e in failed[:70]]}
(ROOT/'index-qa/verified-report.json').write_text(json.dumps(result,indent=2,ensure_ascii=False)+'\n')
print('DONE',len(passed),'working from',len(chosen),'sampled /',int(time.time()-t0),'sec')
