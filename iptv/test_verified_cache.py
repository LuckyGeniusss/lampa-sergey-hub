"""Regression checks for re-checking previously verified streams."""
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from verified_cache import load_cache, save_cache, CACHE_AGE_SECONDS, is_public_stream_url

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

    def test_atomic_save_preserves_old_cache_if_replace_fails(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "verified_cache.json"
            previous = '[{"previous":"valid"}]\n'
            path.write_text(previous, encoding="utf-8")
            new = [{"url": "https://example.org/channel.m3u8",
                    "meta": ["#EXTINF:-1,Example"], "title": "Example"}]
            with patch("verified_cache.os.replace", side_effect=OSError("disk error")):
                with self.assertRaises(OSError):
                    save_cache(path, [], new, now=2000000000)
            self.assertEqual(path.read_text(encoding="utf-8"), previous)
            self.assertEqual(list(path.parent.glob(".verified_cache.json.*.tmp")), [])

    def test_public_url_guard_rejects_malformed_ipv6_and_private_networks(self):
        blocked = [
            "http://[bad-host/live.m3u8",
            "http://127.0.0.1/live",
            "http://10.129.1.223/live",
            "http://192.168.1.2/live",
            "http://169.254.169.254/latest",
            "http://localhost./live",
            "http://sub.local/live",
            "http://[::1]/live",
            "http://[fc00::1234]/live",
            "file:///tmp/local.m3u8",
        ]
        for url in blocked:
            with self.subTest(url=url):
                self.assertFalse(is_public_stream_url(url))
                self.assertIsNone(
                    __import__("verified_cache")._normalise({
                        "url": url, "meta": ["#EXTINF:-1,Bad"], "last_verified": 2000000000
                    })
                )
        for url in (
            "https://example.org/live.m3u8",
            "http://8.8.8.8/channel",
            "https://[2606:4700:4700::1111]/live",
        ):
            with self.subTest(url=url):
                self.assertTrue(is_public_stream_url(url))

if __name__ == "__main__":
    unittest.main()
