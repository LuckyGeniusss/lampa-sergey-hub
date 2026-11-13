import collections
import unittest
from epg_merge import normalise, choose, fix_meta, synthetic_id

class EpgMappingTests(unittest.TestCase):
    def test_quality_and_country_suffix(self):
        self.assertEqual(normalise("TG4 (1080p)"), "tg4")
        self.assertEqual(normalise("24 Kanal HD (720p)"), "24kanal")
    def test_original_tvg_id_preserved(self):
        old='#EXTINF:-1 tvg-id="TG4.ie@SD" group-title="Ирландские каналы",TG4 (1080p)'
        meta=fix_meta(old,"wz_test")
        self.assertIn('tvg-id="wz_test"',meta)
        self.assertIn('tvg-original="TG4.ie@SD"',meta)
        self.assertEqual(meta.count(' tvg-id='),1)
        self.assertEqual(fix_meta(meta,"wz_test2").count('tvg-original='),1)
    def test_original_tvg_id_preferred_on_refresh(self):
        meta=fix_meta('#EXTINF:-1 tvg-id="TG4.ie@SD" group-title="Ирландские каналы",TG4 (1080p)',"wz_test")
        byid=collections.defaultdict(list)
        byname=collections.defaultdict(list)
        byid["tg4.ie@sd"]=[("ie","TG4.ie@SD")]
        selected=choose(meta,"TG4 (1080p)",byid,byname)
        self.assertEqual(selected[0],("ie","TG4.ie@SD"))
    def test_no_ambiguous_match(self):
        byname={"example":[("lite","X1"),("lite","X2")]}
        self.assertIsNone(choose('#EXTINF:-1 group-title="Другие",Example',"Example",{},byname))
    def test_deterministic_hash(self):
        self.assertEqual(synthetic_id("ie","TG4.HD.ie"),synthetic_id("ie","TG4.HD.ie"))

if __name__ == "__main__":
    unittest.main()
