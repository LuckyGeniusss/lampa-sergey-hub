#!/usr/bin/env python3
"""Assign one clear IPTV group per channel; keep every verified URL once."""
import re
from collections import Counter
from pathlib import Path

GROUPS=('Ирландские каналы','Украинские каналы','Русскоязычные каналы','Фильмы','Сериалы','Детские','Документальные','Новости','Спорт','Музыка','Развлечения','Иностранные каналы','Другие')

def category(meta, name):
    t=name.casefold().strip()
    gmatch=re.search(r'group-title="([^"]*)"',meta,re.I)
    g=(gmatch.group(1) if gmatch else '').casefold()
    tidmatch=re.search(r'tvg-id="([^"]*)"',meta,re.I)
    tid=(tidmatch.group(1) if tidmatch else '').casefold()
    keys=' '.join((g,t))
    # Only the actual two verified Irish broadcasters, never UK/Pluto FAST.
    if t in ('tg4', 'tg4 (1080p)', 'oireachtas tv', 'oireachtas tv (720p)') or tid.startswith(('tg4.ie','oireachtastv.ie')):
        return 'Ирландские каналы'
    # Preserve Ukraine broadcasters, rather than burying their news or music.
    if (re.search(r'\.ua(?:@|$)',tid) or g in ('україна 🇺🇦','ukraine','україна','украинские','ukrainian') or
        t.startswith(('1+1', 'ictv', 'суспільне', 'уніан', '24 канал', 'рада ', 'телеканал рада'))):
        return 'Украинские каналы'
    # Explicit Russia category only, don't infer language from Cyrillic.
    if re.search(r'\.ru(?:@|$)',tid) or g in ('russia','россия','російські канали','русские каналы','russian'):
        return 'Русскоязычные каналы'
    if any(k in keys for k in ('kids','child','cartoon','animation','family kids','детск','дитяч','мульт','toons','cbeebies','cbbc','nickelodeon')):
        return 'Детские'
    if any(k in keys for k in ('movies','cinema','kino plus','kino+','kinomix','kinо','кино','фильм','фільм','кинозал','filme','film club','vod movie','vod italy')):
        return 'Фильмы'
    if any(k in keys for k in ('series','serial','сериал','серіал','tv shows','sitcom')):
        return 'Сериалы'
    if any(k in keys for k in ('documentary','education','history','nature','science','документ','познав','история','historical')):
        return 'Документальные'
    if any(k in keys for k in ('news','новости','новини','інформац','информац','breaking news')):
        return 'Новости'
    if any(k in keys for k in ('sport','football','футбол','бокс','sporttv','match tv','setanta')):
        return 'Спорт'
    if any(k in keys for k in ('music','музы','музик','hits','radio music','musical')):
        return 'Музыка'
    if any(k in keys for k in ('entertainment','comedy','reality','show','шоу','юмор','humor','lifestyle','cooking','food','travel','приключ','отдых')):
        return 'Развлечения'
    # Countries were previously encoded as category titles by source.
    if g in ('italy','greece','hungary','france','germany','spain','china','finland','iran','turkey','uzbekistan','united kingdom','usa','uk','belarus','azerbaijan','georgia','romania','portugal','kazakhstan'):
        return 'Иностранные каналы'
    return 'Другие'

def parse(text):
    entries=[];meta=None;options=[]
    for ln in text.splitlines():
        ln=ln.strip()
        if ln.startswith('#EXTINF:'):meta=ln;options=[]
        elif ln.startswith('#') and meta:options.append(ln)
        elif ln.startswith(('http://','https://')) and meta:
            entries.append(dict(meta=meta,options=options,url=ln,name=meta.rsplit(',',1)[-1].strip()))
            meta=None;options=[]
    return entries

def render(entries):
    seen=set(); rows=[];counts=Counter()
    for e in entries:
        url=e['url']
        if url in seen:continue
        seen.add(url)
        meta=e['meta']
        title=e['name']
        group=category(meta,title)
        prefix=meta.rsplit(',',1)[0]
        # Group names from upstream are often mixtures or repeated; overwrite.
        prefix=re.sub(r'\s*group-title="[^"]*"','',prefix,flags=re.I).rstrip()
        meta=prefix+' group-title="'+group+'",'+title
        rows.append((GROUPS.index(group), title.casefold(), meta, list(e.get('options',[])),url,group))
        counts[group]+=1
    rows.sort(key=lambda x:(x[0],x[1]))
    lines=['#EXTM3U']
    for _,_,meta,options,url,_ in rows:
        lines.extend([meta]+options+[url])
    return '\n'.join(lines)+'\n',counts

def from_file(path):
    return parse(Path(path).read_text(encoding='utf-8-sig'))
