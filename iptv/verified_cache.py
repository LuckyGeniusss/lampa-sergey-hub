"""Retain *candidate URLs*, not playable channels, across upstream playlist outages.

Every cached candidate is fed through the same frame-decoding test before publication.
The candidate cache itself is internal and is never exposed as a second IPTV playlist.
"""
import json
import time
from urllib.parse import urlparse
from pathlib import Path

CACHE_AGE_SECONDS = 45 * 24 * 3600
CACHE_LIMIT = 10000

def _normalise(raw):
    if not isinstance(raw, dict):
        return None
    url = raw.get("url")
    meta = raw.get("meta")
    if not isinstance(url, str) or not url.startswith(("http://", "https://")):
        return None
    host = urlparse(url).hostname
    if not host or host in {"localhost", "127.0.0.1", "0.0.0.0"} or host.endswith(".local"):
        return None
    if isinstance(meta, str):
        meta = [meta]
    if not isinstance(meta, list) or not meta or not isinstance(meta[0], str) or not meta[0].startswith("#EXTINF:"):
        return None
    if not all(isinstance(x, str) for x in meta):
        return None
    try:
        verified = int(raw.get("last_verified", 0))
    except (TypeError, ValueError, OverflowError):
        return None
    return {"url": url, "meta": meta,
            "title": str(raw.get("title") or meta[0].rsplit(",", 1)[-1]),
            "last_verified": verified}

def load_cache(path, now=None):
    now = int(time.time() if now is None else now)
    path = Path(path)
    if not path.is_file():
        return []
    raw = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(raw, list):
        raise ValueError("Expected list for verified IPTV candidate cache")
    rows = {}
    for item in raw:
        row = _normalise(item)
        if row is None or row["last_verified"] > now + 86400:
            continue
        if now - row["last_verified"] > CACHE_AGE_SECONDS:
            continue
        old = rows.get(row["url"])
        if old is None or row["last_verified"] > old["last_verified"]:
            rows[row["url"]] = row
    return sorted(rows.values(), key=lambda e: (-e["last_verified"], e["url"]))[:CACHE_LIMIT]

def save_cache(path, old_rows, just_verified, now=None):
    now = int(time.time() if now is None else now)
    rows = {e["url"]: e for e in old_rows}
    for e in just_verified:
        raw_meta = e.get("meta", [])
        if isinstance(raw_meta, str):
            raw_meta = [raw_meta]
        candidate = _normalise({
            "url": e.get("url"), "meta": raw_meta + list(e.get("options", [])),
            "title": e.get("title") or e.get("name"), "last_verified": now
        })
        if candidate:
            rows[candidate["url"]] = candidate
    final = load_cache_rows(rows.values(), now)
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(final, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    return len(final)

def load_cache_rows(raw, now):
    good = []
    for item in raw:
        row = _normalise(item)
        if row and 0 <= now - row["last_verified"] <= CACHE_AGE_SECONDS:
            good.append(row)
    return sorted(good, key=lambda e: (-e["last_verified"], e["url"]))[:CACHE_LIMIT]
