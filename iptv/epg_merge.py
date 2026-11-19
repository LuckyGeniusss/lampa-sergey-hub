#!/usr/bin/env python3
"""Build one XMLTV guide for the verified Wazo playlist and fix its tvg-id mappings.

Unmatched streams remain playable and receive NO fabricated programme entries.
"""
import argparse
import collections
import datetime
import gzip
import hashlib
import json
import pathlib
import re
import shutil
import time
import urllib.request
import xml.etree.ElementTree as ET

from curate_unified import parse

SOURCES = [
    ("lite", "https://iptvx.one/epg/epg_lite.xml.gz"),
    ("ua", "https://epgshare01.online/epgshare01/epg_ripper_UA1.xml.gz"),
    ("ie", "https://epgshare01.online/epgshare01/epg_ripper_IE1.xml.gz"),
    ("uk", "https://epgshare01.online/epgshare01/epg_ripper_UK1.xml.gz"),
    ("ru", "https://iptv-epg.org/files/epg-ru.xml.gz"),
    ("gb", "https://iptv-epg.org/files/epg-gb.xml.gz"),
    ("world", "https://teleonline.github.io/epg/epg.xml.gz"),
    ("de", "https://epgshare01.online/epgshare01/epg_ripper_DE1.xml.gz"),
    ("fr", "https://epgshare01.online/epgshare01/epg_ripper_FR1.xml.gz"),
    ("pl", "https://epgshare01.online/epgshare01/epg_ripper_PL1.xml.gz"),
    ("es", "https://epgshare01.online/epgshare01/epg_ripper_ES1.xml.gz"),
    ("it", "https://epgshare01.online/epgshare01/epg_ripper_IT1.xml.gz"),
    ("nl", "https://epgshare01.online/epgshare01/epg_ripper_NL1.xml.gz"),
]
PUBLIC_EPG = "https://raw.githubusercontent.com/LuckyGeniusss/lampa-sergey-hub/main/iptv/wazo_epg.xml.gz"
NO_EPG_GROUPS = {"Фильмы", "Сериалы"}

def normalise(text):
    text = str(text).casefold().replace("ё", "е").replace("&", "and")
    text = re.sub(r"\([^)]*\)|\[[^\]]*\]", " ", text)
    text = re.sub(r"\b(uhd|fhd|hd|sd|4k|1080p|720p|576p|480p|channel|телеканал|канал|stream)\b", " ", text)
    text = re.sub(r"\b(ukraine|украина|україна|russia|россия)\b", " ", text)
    text = re.sub(r"[^a-zа-яіїєґ0-9]+", "", text)
    return text

def extract_group(meta):
    m = re.search(r'group-title="([^"]+)"', meta)
    return m.group(1) if m else ""

def extract_id(meta):
    m = re.search(r'tvg-id="([^"]+)"', meta)
    return m.group(1) if m else ""

def download_sources(folder, download=True):
    folder = pathlib.Path(folder)
    folder.mkdir(parents=True, exist_ok=True)
    fetched = {}
    for name, url in SOURCES:
        target = folder / (name + ".xml.gz")
        if not download:
            if target.is_file():
                fetched[name] = target
            continue
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "WazoTV-EPG/1.0"})
            temp = target.with_suffix(target.suffix + ".part")
            with urllib.request.urlopen(req, timeout=35) as reply, temp.open("wb") as out:
                total = 0
                while True:
                    chunk = reply.read(1024 * 1024)
                    if not chunk:
                        break
                    total += len(chunk)
                    if total > 35_000_000:
                        raise ValueError("compressed XMLTV source too large")
                    out.write(chunk)
            with gzip.open(temp, "rb") as f:
                if f.read(300).find(b"<") < 0:
                    raise ValueError("not XMLTV gzip")
            temp.replace(target)
            fetched[name] = target
        except Exception as exc:
            temp.unlink(missing_ok=True)
            if target.is_file():
                fetched[name] = target
            print("EPG_SOURCE_FAIL", name, str(exc)[:160], flush=True)
    if len(fetched) < 2:
        raise RuntimeError("Need at least two live/cached XMLTV source files")
    return fetched

def rank(source, group):
    if group == "Ирландские каналы":
        order = ("ie", "gb", "uk", "lite", "world", "ua", "ru")
    elif group == "Украинские каналы":
        order = ("ua", "lite", "world", "ru", "uk", "gb", "ie")
    elif group == "Русскоязычные каналы":
        order = ("lite", "ru", "ua", "world", "gb", "uk", "ie")
    else:
        order = ("lite", "world", "gb", "uk", "ua", "ie", "ru")
    # Preserve existing source preference; additional verified guides only
    # fill exact-name/ID gaps and cannot override an existing preferred match.
    if source in order:
        return order.index(source)
    extra = ("de", "fr", "pl", "es", "it", "nl")
    return len(order) + (extra.index(source) if source in extra else len(extra))

def make_indices(sources):
    byid = collections.defaultdict(list)
    byname = collections.defaultdict(list)
    channels = {}
    for source, filename in sources.items():
        count = 0
        with gzip.open(filename, "rb") as f:
            root = None
            for event, node in ET.iterparse(f, events=("start", "end")):
                if root is None:
                    root = node
                if event != "end":
                    continue
                if node.tag == "channel":
                    cid = node.get("id", "")
                    if cid:
                        labels = [x.text.strip() for x in node.findall("display-name")
                                  if x.text and x.text.strip()]
                        row = (source, cid)
                        channels[row] = ET.tostring(node, encoding="utf-8")
                        byid[cid.casefold()].append(row)
                        for value in labels + [cid]:
                            n = normalise(value)
                            if len(n) > 2 and len(n) < 80:
                                byname[n].append(row)
                        count += 1
                    root.clear()
                elif node.tag == "programme":
                    root.clear()
        print("EPG_INDEXED", source, count, flush=True)
    return byid, byname, channels

def choose(meta, title, byid, byname):
    group = extract_group(meta)
    old_id = extract_id(meta)
    original = re.search(r'tvg-original="([^"]+)"', meta)
    if original:
        old_id = original.group(1)
    if old_id.startswith("wz_"):
        old_id = ""
    exact = list(byid.get(old_id.casefold(), ())) if old_id else []
    candidates = exact
    method = "exact"
    if not candidates and old_id:
        key = normalise(re.sub(r"(?:@[A-Za-z0-9]+|\.(?:ua|ie|uk|ru|us))$", "", old_id, flags=re.I))
        candidates = list(byname.get(key, ()))
        method = "id"
    if not candidates:
        candidates = list(byname.get(normalise(title), ()))
        method = "name"
    candidates = sorted(set(candidates), key=lambda r: (rank(r[0], group), len(r[1]), r[1]))
    if not candidates:
        return None
    first = candidates[0]
    # Never guess between multiple different channels from the same preferred source.
    if any(r[0] == first[0] and r[1] != first[1] for r in candidates):
        return None
    return first, method

def synthetic_id(source, original_id):
    return "wz_" + hashlib.sha256((source + ":" + original_id).encode()).hexdigest()[:18]

def fix_meta(meta, new_id):
    previous = extract_id(meta)
    if previous and not previous.startswith("wz_") and "tvg-original=" not in meta:
        meta = re.sub(r"^(#EXTINF:\S+)", lambda m: m.group(1) + ' tvg-original="' + previous + '"', meta, count=1)
    meta = re.sub(r'\s+tvg-id="[^"]*"', "", meta)
    return re.sub(r"^(#EXTINF:\S+)", lambda m: m.group(1) + ' tvg-id="' + new_id + '"', meta, count=1)

def rebuild(playlist_path, output_path, epg_output, source_files):
    playlist_path = pathlib.Path(playlist_path)
    entries = parse(playlist_path.read_text(encoding="utf-8"))
    byid, byname, channels = make_indices(source_files)
    mappings = {}
    methods = collections.Counter()
    groups = collections.defaultdict(collections.Counter)
    channel_names = collections.defaultdict(set)
    new_lines = ['#EXTM3U url-tvg="' + PUBLIC_EPG + '"']
    for item in entries:
        meta, title = item["meta"], item["name"]
        group = extract_group(meta)
        selected = None if group in NO_EPG_GROUPS else choose(meta, title, byid, byname)
        if selected:
            (src, cid), method = selected
            new_id = synthetic_id(src, cid)
            mappings[(src, cid)] = new_id
            channel_names[(src, cid)].add(title)
            meta = fix_meta(meta, new_id)
            methods[method] += 1
            groups[group]["mapped"] += 1
        else:
            groups[group]["unmatched"] += 1
        new_lines.append(meta)
        new_lines.extend(item["options"])
        new_lines.append(item["url"])
    if sum(methods.values()) < 300:
        raise RuntimeError("EPG mapping too small; no destructive playlist rewrite")
    used = collections.Counter()
    counts = collections.Counter()
    epg_output = pathlib.Path(epg_output)
    tmp = epg_output.with_name(epg_output.name + ".part")
    with gzip.open(tmp, "wb", compresslevel=7) as output:
        output.write(b'<?xml version="1.0" encoding="UTF-8"?>\n<tv generator-info-name="Wazo TV EPG">\n')
        for (src, cid), newid in sorted(mappings.items()):
            element = ET.fromstring(channels[(src, cid)])
            element.set("id", newid)
            # Include familiar Wazo channel names to support manual matching.
            existing = {normalise(n.text) for n in element.findall("display-name") if n.text}
            for title in sorted(channel_names[(src, cid)]):
                if normalise(title) not in existing:
                    ET.SubElement(element, "display-name").text = title
                    existing.add(normalise(title))
            output.write(ET.tostring(element, encoding="utf-8"))
            output.write(b"\n")
        for src, file in source_files.items():
            selected = {cid: nid for (source, cid), nid in mappings.items() if source == src}
            if not selected:
                continue
            with gzip.open(file, "rb") as stream:
                root = None
                for event, element in ET.iterparse(stream, events=("start","end")):
                    if root is None:
                        root = element
                    if event != "end":
                        continue
                    if element.tag == "programme":
                        old_id = element.get("channel", "")
                        if old_id in selected:
                            element.set("channel", selected[old_id])
                            output.write(ET.tostring(element, encoding="utf-8"))
                            output.write(b"\n")
                            used[(src, old_id)] += 1
                            counts[src] += 1
                        root.clear()
                    elif element.tag == "channel":
                        root.clear()
        output.write(b"</tv>\n")
    tmp.replace(epg_output)
    mapped_prog = sum(1 for row in mappings if used[row])
    if mapped_prog < 180:
        raise RuntimeError("Too few programme-bearing channels; cannot publish")
    # Never remove any stream or replace the playlist if EPG construction failed.
    text = "\n".join(new_lines) + "\n"
    pathlib.Path(output_path).write_text(text, encoding="utf-8")
    report = {"streams": len(entries), "assigned": sum(methods.values()),
              "with_programme": mapped_prog, "methods": dict(methods),
              "groups": {k:dict(v) for k,v in groups.items()},
              "programmes":sum(counts.values()), "by_source":dict(counts),
              "epg_gzip_bytes":epg_output.stat().st_size}
    return report

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--playlist", required=True)
    parser.add_argument("--out-m3u", required=True)
    parser.add_argument("--out-epg", required=True)
    parser.add_argument("--sources-dir", required=True)
    parser.add_argument("--offline", action="store_true")
    args = parser.parse_args()
    sources = download_sources(args.sources_dir, download=not args.offline)
    report = rebuild(args.playlist, args.out_m3u, args.out_epg, sources)
    out = pathlib.Path(args.out_epg).with_suffix(".report.json")
    out.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
    print("EPG_DONE",json.dumps(report,ensure_ascii=False), flush=True)

if __name__ == "__main__":
    main()
