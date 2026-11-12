#!/usr/bin/env python3
"""Fast, dependency-free schema regression before multi-hour playlist probing."""
import unittest
from curate_unified import parse, render, GROUPS

class TestUnifiedRender(unittest.TestCase):
    def test_builder_schema_list_meta_and_title(self):
        rows=[{'url':'https://example.net/playlist/1.m3u8',
               'meta':['#EXTINF:-1 tvg-id="tg4.ie" group-title="Ireland",TG4', '#EXTVLCOPT:http-user-agent=Demo'],
               'title':'TG4'}]
        m3u,counts=render(rows)
        self.assertEqual(counts['Ирландские каналы'],1)
        self.assertIn('#EXTVLCOPT:http-user-agent=Demo',m3u)
        self.assertIn('group-title="Ирландские каналы",TG4',m3u)
    def test_legacy_parser_and_duplicate_url(self):
        m3u='\n'.join(['#EXTM3U','#EXTINF:-1 group-title="Украинские каналы",Новый канал',
                       '#EXTVLCOPT:network-caching=1000','https://example.net/a.m3u8'])
        old=parse(m3u)
        res,counts=render(old+old)
        self.assertEqual(len(parse(res)),1)
        self.assertEqual(counts['Украинские каналы'],1)
        self.assertIn('#EXTVLCOPT:network-caching=1000',res)
    def test_fallback_name_and_invalid_metadata(self):
        rows=[{'url':'https://example.net/a.m3u8','meta':['#EXTINF:-1 group-title="Спорт",Setanta Sports']},
              {'url':'https://example.net/b.m3u8','meta':[]},
              {'url':'https://example.net/b.m3u8','meta':['#EXTINF:-1,Music TV'],'title':'Music TV'}]
        res,c=render(rows)
        self.assertEqual(len(parse(res)),2)
        self.assertEqual(c['Спорт'],1)
        self.assertEqual(c['Музыка'],1)
    def test_group_order(self):
        e=[{'url':f'https://example.net/{i}.m3u8','meta':f'#EXTINF:-1 group-title="{g}",{g}', 'name':g} for i,g in enumerate(GROUPS)]
        res,c=render(e)
        self.assertEqual(len(parse(res)),len(GROUPS))
        self.assertEqual(sum(c.values()),len(GROUPS))

if __name__ == '__main__':unittest.main()
