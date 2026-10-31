#!/usr/bin/env python3
"""Merge only verified nonduplicate world streams into the single Wazo M3U."""
from pathlib import Path
import json, sys, time, collections
ROOT=Path(__file__).resolve().parent
sys.path.insert(0,str(ROOT))
from curate_unified import from_file,render,GROUPS
qa=json.loads((ROOT/'index-qa/verified-report.json').read_text())
assert qa['source']=='https://iptv-org.github.io/iptv/index.m3u'
assert qa['tested'] >= 500 and qa['passed'] >= 50
old=from_file(ROOT/'wazo_tv.m3u')
urls={e['url'] for e in old}
new=[]
for e in qa['streams']:
    if e['url'] in urls:continue
    assert e['meta'].startswith('#EXTINF:') and e['url'].startswith(('http://','https://'))
    urls.add(e['url'])
    new.append({k:e[k] for k in ('name','url','meta','options')})
assert len(new)==qa['passed'],(len(new),qa['passed'])
out,groups=render(old+new)
full=ROOT/'wazo_tv.m3u'
full.write_text(out,encoding='utf8')
assert sum(groups.values())==len(old)+len(new)
assert len({x for x in out.splitlines() if x.startswith(('http://','https://'))})==len(old)+len(new)
source_path=ROOT/'sources/world_verified.json'
source_path.parent.mkdir(parents=True,exist_ok=True)
source_path.write_text(json.dumps(new,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
statpath=ROOT/'wazo_status.json'
stats=json.loads(statpath.read_text())
stats['working']=len(old)+len(new)
stats['checked']=int(stats.get('checked',0))+int(qa['tested'])
stats['groups']=dict(groups)
stats['world_index_qa']={
 'source':qa['source'],
 'date_utc':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),
 'index_entries':qa['downloaded_unique'],
 'sample_checked':qa['tested'],
 'sample_passed':qa['passed'],
 'new_urls_added':len(new),
 'by_group_passed':qa['by_group_passed']
}
stats['by_source']['IPTV-org world verified']=len(new)
stats['date_utc']=time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime())
statpath.write_text(json.dumps(stats,ensure_ascii=False,indent=2)+'\n')
print('ADDED',len(new),'NEW TOTAL',len(old)+len(new),'NEW GROUP COUNTS',dict(groups),flush=True)
