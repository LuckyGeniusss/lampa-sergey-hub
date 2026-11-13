"""Regression checks for re-checking previously verified streams."""
import json
import tempfile
import unittest
from pathlib import Path
from verified_cache import load_cache, save_cache, CACHE_AGE_SECONDS

class VerifiedCacheTest(unittest.TestCase):
    def test_retain_candidates_but_require_reverification(self):
        with tempfile.TemporaryDirectory() as tmp:
            p = Path(tmp) / "verified_cache.json"
            now = 2000000000
            old = [{"url": "https://example.net/live.m3u8",
                    "meta": ['#EXTINF:-1 group-title="Украинские каналы",Test'],
                    "title": "Test", "last_verified": now - 3600}]
            p.write_text(json.dumps(old), encoding="utf-8")
            self.assertEqual(len(load_cache(p, now=now)), 1)
            self.assertEqual(save_cache(p, load_cache(p, now), [], now=now), 1)
            # Output cache retains a candidate URL even when it fails decoding.
            verified = [{"url": "https://example.net/new.m3u8",
                         "meta": ['#EXTINF:-1 group-title="Ирландские каналы",New'],
                         "title": "New"}]
            self.assertEqual(save_cache(p, load_cache(p, now), verified, now=now), 2)
            self.assertEqual(len(load_cache(p, now)), 2)
    def test_reject_expired_local_and_malformed(self):
        with tempfile.TemporaryDirectory() as tmp:
            p = Path(tmp) / "verified_cache.json"
            now = 2000000000
            good = {"url": "https://example.org/s.m3u8",
                    "meta": ["#EXTINF:-1,Stream"], "last_verified": now-1}
            values = [good, {**good, "last_verified": now - CACHE_AGE_SECONDS - 1},
                      {**good, "url": "http://127.0.0.1/bad"},
                      {**good, "url": "file:///tmp/a"},
                      {**good, "meta": ["bad"]}]
            p.write_text(json.dumps(values), encoding="utf-8")
            rows = load_cache(p, now=now)
            self.assertEqual([x["url"] for x in rows], ["https://example.org/s.m3u8"])
    def test_reject_broken_json_structure(self):
        with tempfile.TemporaryDirectory() as tmp:
            p = Path(tmp) / "verified_cache.json"
            p.write_text('{"invalid":true}', encoding="utf-8")
            with self.assertRaises(ValueError):
                load_cache(p, now=2000000000)

if __name__ == "__main__":
    unittest.main()
