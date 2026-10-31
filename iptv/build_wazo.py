#!/usr/bin/env python3
"""Wazo TV: verify video frames for public IPTV streams, remove broken streams and local URLs."""
from concurrent.futures import ThreadPoolExecutor, as_completed
from urllib.parse import urlparse
import urllib.request, pathlib, json, subprocess, time, re, collections, sys, shutil, os
ROOT=pathlib.Path(__file__).resolve().parent
DEST=ROOT
DEST.mkdir(exist_ok=True)
SOURCES={
 'UA IPTV-org':'https://iptv-org.github.io/iptv/countries/ua.m3u',
 'RU-language IPTV-org':'https://iptv-org.github.io/iptv/languages/rus.m3u',
 'IE IPTV-org':'https://iptv-org.github.io/iptv/countries/ie.m3u',
 'UA Free-TV':'https://raw.githubusercontent.com/Free-TV/IPTV/master/playlists/playlist_ukraine.m3u8',
 'RU Free-TV':'https://raw.githubusercontent.com/Free-TV/IPTV/master/playlists/playlist_russia.m3u8',
 'Provider':'https://tva.org.ua/ip/sam/provayder.m3u',
 'Kino Plus':'https://iptv.org.ua/iptv/kino-plus.m3u',
 'UA IPTV-org-UA':'https://iptv.org.ua/iptv/ua.m3u',
 'Kids':'https://iptv.org.ua/iptv/kids.m3u',
 'PeersTV (moved)':'https://iptv.org.ua/iptv/peerstv.m3u',
 'Kherson webcam':'https://webcams.ks.ua/hls/ch0038.m3u8',
 'Free-TV worldwide':'https://raw.githubusercontent.com/Free-TV/IPTV/master/playlist.m3u8'
}
all_entries=[]
seen={}
source_stats={}
for name,addr in SOURCES.items():
 try:
  if addr.startswith('local://'):
   text=(ROOT/addr.removeprefix('local://')).read_text(encoding='utf-8-sig')
  else:
   req=urllib.request.Request(addr,headers={'User-Agent':'Mozilla/5.0 (Macintosh; Intel Mac OS X)','Accept':'*/*'})
   response=urllib.request.urlopen(req,timeout=18)
   text=response.read(1500000).decode('utf-8-sig','replace')
  lines=text.splitlines()
  pending=[]
  new=0
  for line in lines:
   line=line.strip()
   if line.startswith('#EXTINF'): pending=[line]
   elif line.startswith('#') and pending: pending.append(line)
   elif line.startswith(('http://','https://')) and pending:
    url=line.strip()
    host=urlparse(url).hostname
    if not host or host in ('127.0.0.1','localhost','0.0.0.0') or host.endswith('.local'):
     pending=[];continue
    if url not in seen:
     # Don't include revision notices, or dead-man messages.
     title=pending[0].split(',',1)[-1]
     if 'ревизия' not in title.lower() and 'адрес плейлиста изменился' not in title.lower():
      seen[url]=len(all_entries)
      all_entries.append({'url':url,'meta':pending[:],'source':name,'title':title})
      new+=1
    pending=[]
  source_stats[name]={'fetched':True,'extinf':text.count('#EXTINF'),'unique_added':new}
 except Exception as exc:
  source_stats[name]={'fetched':False,'error':str(exc)[:180]}
 print('SOURCE',name,source_stats[name],flush=True)
# Official HLS parliamentary broadcast. hls_1/2/3 are quality variants.
oirtv_url='https://oirtv.oireachtas.ie/hls_2.m3u8'
if oirtv_url not in seen:
 seen[oirtv_url]=len(all_entries)
 all_entries.append({
  'url':oirtv_url,
  'meta':['#EXTINF:-1 tvg-id="OireachtasTV.ie" group-title="Ирландские каналы",Oireachtas TV'],
  'source':'IE Oireachtas official','title':'Oireachtas TV'
 })
# Curated, frame-tested streams from the worldwide IPTV-org index.
# JSON is an internal source manifest, never a user-facing second playlist.
world_manifest=ROOT/'sources/world_verified.json'
if world_manifest.is_file():
 try:
  world_entries=json.loads(world_manifest.read_text(encoding='utf8'))
  count=0
  for e in world_entries:
   url=e.get('url','')
   meta=e.get('meta','')
   if not url.startswith(('http://','https://')) or not meta.startswith('#EXTINF:') or url in seen:
    continue
   host=urlparse(url).hostname
   if not host or host in ('127.0.0.1','localhost','0.0.0.0') or host.endswith('.local'):
    continue
   seen[url]=len(all_entries)
   all_entries.append({'url':url,'meta':[meta]+e.get('options',[]),
                       'source':'IPTV-org world verified',
                       'title':e.get('name') or meta.rsplit(',',1)[-1]})
   count+=1
  source_stats['IPTV-org world verified']={'fetched':True,'extinf':len(world_entries),'unique_added':count}
 except Exception as exc:
  source_stats['IPTV-org world verified']={'fetched':False,'error':str(exc)[:180]}
(DEST/'source_stats.json').write_text(json.dumps(source_stats,indent=2,ensure_ascii=False))
print('CANDIDATES',len(all_entries),flush=True)
(DEST/'candidates.json').write_text(json.dumps(all_entries,ensure_ascii=False))
# Report successful, decodable video frames. HEAD/HTTP200 is insufficient.
FFMPEG='/opt/homebrew/bin/ffmpeg' if pathlib.Path('/opt/homebrew/bin/ffmpeg').exists() else shutil.which('ffmpeg')
if not FFMPEG: raise SystemExit('ffmpeg not installed')
def check(entry):
 url=entry['url']
 cmd=[FFMPEG,'-hide_banner','-nostdin','-loglevel','error','-rw_timeout','5000000','-analyzeduration','1200000','-probesize','131072']
 if 'http-user-agent=' in entry['meta'][0]:
  match=re.search(r'http-user-agent="([^"]+)"',entry['meta'][0])
  if match: cmd.extend(['-user_agent',match.group(1)])
 cmd.extend(['-i',url,'-map','0:v:0','-frames:v','12','-f','null','-'])
 try:
  r=subprocess.run(cmd,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE,timeout=13)
  return {'url':url,'ok':r.returncode==0,'error':r.stderr.decode('utf8','replace')[-180:] if r.returncode else ''}
 except Exception as exc:
  return {'url':url,'ok':False,'error':str(exc)[:100]}
t0=time.time()
results={}
with ThreadPoolExecutor(max_workers=int(os.environ.get('WAZO_IPTV_WORKERS','24'))) as pool:
 jobs={pool.submit(check,e):e for e in all_entries}
 for idx,f in enumerate(as_completed(jobs),1):
  r=f.result();results[r['url']]=r
  if idx%200==0: print('PROGRESS',idx,'/',len(all_entries),'ok',sum(v['ok'] for v in results.values()),'sec',int(time.time()-t0),flush=True)
okay={url for url,r in results.items() if r['ok']}
if len(okay)<200:
 raise SystemExit('Safety abort: fewer than 200 streams passed, keep previous verified playlists')
from curate_unified import render
channels=collections.Counter()
verified_entries=[item for item in all_entries if item['url'] in okay]
unified,groups=render(verified_entries)
(DEST/'wazo_tv.m3u').write_text(unified,encoding='utf8')
for item in verified_entries:channels[item['source']]+=1
report={'date_utc':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),'checked':len(all_entries),'working':len(okay),'groups':dict(groups),'ireland_verified':groups.get('Ирландские каналы',0),'unified_playlist':'iptv/wazo_tv.m3u','by_source':channels,'sources':source_stats,'seconds':round(time.time()-t0),'errors':collections.Counter(r['error'].split('\n')[-1][:100] for r in results.values() if not r['ok']).most_common(20)}
(DEST/'wazo_status.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
(DEST/'failures.json').write_text(json.dumps([x for x in results.values() if not x['ok']],ensure_ascii=False))
print('DONE',json.dumps({k:v for k,v in report.items() if k not in ['sources','errors']},ensure_ascii=False,default=dict),flush=True)
