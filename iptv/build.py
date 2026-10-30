#!/usr/bin/env python3
"""Merge public UA and Russian-language IPTV catalogues."""
import urllib.request
from pathlib import Path
sources = [
    ("Ukraine", "https://iptv-org.github.io/iptv/countries/ua.m3u"),
    ("Russian", "https://iptv-org.github.io/iptv/languages/rus.m3u"),
]
out = ["#EXTM3U"]
seen = set()
for group, url in sources:
    request = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    lines = urllib.request.urlopen(request, timeout=30).read().decode("utf-8-sig").splitlines()
    meta = []
    for line in lines[1:]:
        line = line.strip()
        if line.startswith("#EXTINF"):
            meta = [line]
        elif line.startswith("#") and meta:
            meta.append(line)
        elif line and meta:
            if line not in seen:
                seen.add(line)
                out.extend(meta + [line])
            meta = []
Path(__file__).with_name("combined.m3u").write_text("\n".join(out) + "\n", encoding="utf-8")
print(f"Unique streams: {len(seen)}")
