import collections
import unittest
from epg_merge import normalise, choose, fix_meta, synthetic_id, rank

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
    def test_added_guides_are_fallback_only(self):
        self.assertLess(rank("lite", "Иностранные каналы"), rank("fr", "Иностранные каналы"))
        self.assertLess(rank("ie", "Ирландские каналы"), rank("de", "Ирландские каналы"))
        self.assertLess(rank("ua", "Украинские каналы"), rank("pl", "Украинские каналы"))
        self.assertEqual(choose('#EXTINF:-1 group-title="Иностранные каналы",ARTE', "ARTE",
                                {}, {"arte": [("de", "Arte.de")]}),
                         (("de", "Arte.de"), "name"))

    def test_ua_aliases_keep_broadcasters_separate(self):
        meta = '#EXTINF:-1 group-title="Украинские каналы",1+1'
        ids = ["1+1.Україна.[UA-UA].ua", "1+1.Україна.[UA-RU].ua",
               "1+1.International.[UA-UA].ua", "1+1.Марафон.HD.[UA-UA].ua",
               "Суспільне.Дніпро.[UA-UA].ua", "Суспільне.Дніпро.(OTT).[UA-UA].ua"]
        byid = {cid.casefold(): [("ua", cid)] for cid in ids}
        for title, expected in [
            ("1+1 Україна (UA)", ids[0]),
            ("1+1 International HD (720p)", ids[2]),
            ("1+1 Марафон HD", ids[3]),
            ("Суспільне Дніпро", ids[4]),
        ]:
            self.assertEqual(choose(meta, title, byid, {}), (("ua", expected), "ua_alias"))
        self.assertIsNone(choose(meta, "1+1 Unknown", byid, {}))
        self.assertIsNone(choose(meta.replace("Украинские каналы", "Другие"),
                                 "1+1 Україна", byid, {}))

    def test_deterministic_hash(self):
        self.assertEqual(synthetic_id("ie","TG4.HD.ie"),synthetic_id("ie","TG4.HD.ie"))

if __name__ == "__main__":
    unittest.main()
