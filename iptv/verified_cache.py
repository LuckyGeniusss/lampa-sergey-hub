"""Retain *candidate URLs*, not playable channels, across upstream playlist outages.

Every cached candidate is fed through the same frame-decoding test before publication.
The candidate cache itself is internal and is never exposed as a second IPTV playlist.
"""
import ipaddress
import json
import os
import tempfile
import time
from urllib.parse import urlsplit
from pathlib import Path

CACHE_AGE_SECONDS = 45 * 24 * 3600
CACHE_LIMIT = 10000

def is_public_stream_url(url):
    """Reject malformed, local and non-public IP endpoints in upstream playlists."""
    if not isinstance(url, str) or not url.startswith(("http://", "https://")):
        return False
    try:
        host = urlsplit(url).hostname
    except ValueError:  # malformed IPv6 brackets / invalid URL
        return False
    if not host:
        return False
    host = host.rstrip(".").lower()
    if host == "localhost" or host.endswith((".localhost", ".local")):
        return False
    try:
        return ipaddress.ip_address(host).is_global
    except ValueError:
        return True  # DNS hostname; network availability is checked by ffmpeg

def _normalise(raw):
    if not isinstance(raw, dict):
        return None
    url = raw.get("url")
    meta = raw.get("meta")
    if not is_public_stream_url(url):
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
    contents = json.dumps(final, ensure_ascii=False, separators=(",", ":")) + "\n"
    temp_path = None
    try:
        # Replace only after the entire JSON has been written and flushed.
        with tempfile.NamedTemporaryFile(
            mode="w", encoding="utf-8", dir=path.parent,
            prefix=f".{path.name}.", suffix=".tmp", delete=False
        ) as stream:
            temp_path = Path(stream.name)
            stream.write(contents)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temp_path, path)
    finally:
        if temp_path is not None:
            temp_path.unlink(missing_ok=True)
    return len(final)

def load_cache_rows(raw, now):
    good = []
    for item in raw:
        row = _normalise(item)
        if row and 0 <= now - row["last_verified"] <= CACHE_AGE_SECONDS:
            good.append(row)
    return sorted(good, key=lambda e: (-e["last_verified"], e["url"]))[:CACHE_LIMIT]


def recover_candidates_from_playlist(path, now=None):
    """Recover candidates from a previously published M3U, never treat them as verified."""
    now = int(time.time() if now is None else now)
    path = Path(path)
    if not path.is_file():
        return []
    text = path.read_text(encoding="utf-8-sig")
    if not text.lstrip().startswith("#EXTM3U"):
        return []
    rows = {}
    metadata = []
    for line in text.splitlines():
        line = line.strip()
        if line.startswith("#EXTINF:"):
            metadata = [line]
        elif line.startswith("#") and metadata:
            metadata.append(line)
        elif line.startswith(("http://", "https://")):
            if metadata:
                row = _normalise({
                    "url": line, "meta": metadata, "last_verified": now
                })
                if row:
                    # Preserve original channel metadata and VLC options on duplicate URLs.
                    rows.setdefault(row["url"], row)
            metadata = []
        elif line:
            metadata = []
    return list(rows.values())[:CACHE_LIMIT]


def load_cache_with_fallback(cache_path, previous_playlist_path, now=None):
    """Recover only if the internal JSON cache is unreadable; re-verify all candidates."""
    try:
        return load_cache(cache_path, now=now), None
    except (ValueError, UnicodeError, OSError) as exc:
        recovered = recover_candidates_from_playlist(previous_playlist_path, now=now)
        if not recovered:
            raise ValueError("IPTV cache unreadable and no valid previous playlist") from exc
        return recovered, type(exc).__name__
