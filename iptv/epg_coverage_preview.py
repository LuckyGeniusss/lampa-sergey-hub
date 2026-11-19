#!/usr/bin/env python3
"""Compare current and expanded EPG using the same downloaded source snapshots.

No files in the repository are changed. No streaming URLs are modified.
"""
import json,os,pathlib,re,sys
from epg_merge import SOURCES,download_sources,rebuild
OLD_KEYS={'lite','ua','ie','uk','ru','gb','world'}
P=pathlib.Path(__file__).resolve().parent
T=pathlib.Path(os.environ.get('RUNNER_TEMP','/tmp'))/'wazo-epg-coverage'
T.mkdir(parents=True,exist_ok=True)
SRC=download_sources(T/'sources')
OLD={k:v for k,v in SRC.items() if k in OLD_KEYS}
if len(OLD)<5:raise RuntimeError('Not enough baseline EPG sources')
if len(SRC)<=len(OLD):raise RuntimeError('No additional sources were downloaded')
def build(label,files):
 m3u=T/(label+'.m3u');epg=T/(label+'.xml.gz')
 report=rebuild(P/'wazo_tv.m3u',m3u,epg,files)
 return report,m3u
base,oldm3u=build('baseline',OLD)
new,newm3u=build('expanded',SRC)
def urls(path):
 return [x for x in path.read_text().splitlines() if x.startswith(('http://','https://'))]
original=urls(P/'wazo_tv.m3u')
assert urls(oldm3u)==original
assert urls(newm3u)==original
assert new['assigned']>=base['assigned']
assert new['with_programme']>=base['with_programme']
result={'baseline':base,'expanded':new,'sources':list(SRC),
        'assigned_gain':new['assigned']-base['assigned'],
        'programme_channel_gain':new['with_programme']-base['with_programme']}
(T/'preview_report.json').write_text(json.dumps(result,ensure_ascii=False,indent=2))
print('EPG_COMPARE',json.dumps({
 'baseline':{'assigned':base['assigned'],'with_programme':base['with_programme']},
 'expanded':{'assigned':new['assigned'],'with_programme':new['with_programme']},
 'sources':list(SRC)},ensure_ascii=False),flush=True)
