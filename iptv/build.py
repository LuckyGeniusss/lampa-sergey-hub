#!/usr/bin/env python3
"""Build a checked UA/RU live-TV playlist from public sources."""
import concurrent.futures, json, pathlib, subprocess, urllib.request, time
ROOT = pathlib.Path(__file__).resolve().parent
SOURCES = [
 "https://iptv-org.github.io/iptv/countries/ua.m3u",
 "https://iptv-org.github.io/iptv/languages/rus.m3u",
 "https://raw.githubusercontent.com/Free-TV/IPTV/master/playlists/playlist_ukraine.m3u8",
 "https://raw.githubusercontent.com/Free-TV/IPTV/master/playlists/playlist_russia.m3u8",
]
entries, seen = [], set()
for source in SOURCES:
 try:
  request = urllib.request.Request(source, headers={"User-Agent":"Mozilla/5.0"})
  lines = urllib.request.urlopen(request, timeout=25).read().decode("utf-8-sig").splitlines()
  meta = []
  for line in lines[1:]:
   line = line.strip()
   if line.startswith("#EXTINF"): meta = [line]
   elif line.startswith("#") and meta: meta.append(line)
   elif line.startswith(("https://","http://")) and meta:
    if line not in seen:
     seen.add(line)
     entries.append((meta, line, source))
    meta = []
 except Exception as exc: print("Source unavailable:", source, exc, flush=True)
def probe(entry):
 url = entry[1]
 try:
  cmd = ["ffprobe","-v","error","-rw_timeout","5000000","-analyzeduration","750000","-probesize","32768","-show_entries","stream=codec_type","-of","json",url]
  result = subprocess.run(cmd, capture_output=True, text=True, timeout=9)
  return result.returncode == 0 and any(s.get("codec_type") == "video" for s in json.loads(result.stdout or "{}").get("streams",[]))
 except Exception: return False
with concurrent.futures.ThreadPoolExecutor(max_workers=20) as executor:
 checks = list(executor.map(probe, entries))
playlist = ["#EXTM3U"]
for (meta,url,_),good in zip(entries,checks):
 if good: playlist.extend(meta + [url])
(ROOT/"verified.m3u").write_text("\n".join(playlist)+"\n",encoding="utf-8")
movies = ["#EXTM3U"]
for (meta, url, _), good in zip(entries, checks):
 if good and any(tag in meta[0].lower() for tag in ['group-title="movies"', 'group-title="series"', 'group-title="documentary"', 'group-title="animation"']):
  movies.extend(meta + [url])
(ROOT/"movies-series.m3u").write_text("\n".join(movies)+"\n",encoding="utf-8")
(ROOT/"status.json").write_text(json.dumps({"total":len(entries),"verified":sum(checks),"checked_at_utc":time.strftime("%Y-%m-%dT%H:%M:%SZ",time.gmtime()),"sources":SOURCES},ensure_ascii=False,indent=2)+"\n")
print("Probed:",len(entries),"video streams:",sum(checks),flush=True)
