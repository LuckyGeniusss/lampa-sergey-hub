# Wazo TV — work plan / 2026-10-31

## Verified state
- Fire Stick 10.129.1.223 connects by ADB from Mac mini; package ie.siaivo.tv version 2.5.2.
- Source plugin 1.5.7 publicly hosted on GitHub Pages (before this change).
- Cloud backend online; reports 78 configured sources, 82 discovery entries. For The Matrix, 28 search-positive providers; **search success is not playback proof**.
- IPTV app points to published wazo_tv.m3u and wazo_cinema.m3u. Keep these lists and user settings.
- Previous S Online injection removed in installed APK 2.5.2; visual end-to-end playback needs separate confirmation.

## Implemented in plugin 1.5.8
- Unified source picker includes all discovered provider rows with unavailable state.
- Wait for provider discovery completion rather than resolving on first provider.
- Remove provider aliases/doubles; filter autopick to available only.
- Bounded auto-fallback with per-title failed-provider cache (10 minutes).
- Do not overwrite manual preference on automatic fallback.
- Keep the original Lampa / Wazo playback interface and IPTV setup.

## Next tasks
1. On-device verify source list and actual HLS/MP4 playback (movie and series) after publishing.
2. Audit a reproducible sample of IPTV channel playback on Fire TV; remove dead streams without deleting user playlists.
3. Fix distorted app icons and square logo, then validate on TV at native dimensions.
4. Verify remote control, Wolf Launcher Home behaviour, and persistence across reboot.
5. Monitor Projectivy premium purchase through the existing separately scheduled task; do not bypass licensing.
6. Re-check cloud provider health periodically, but do not equate HTTP 200 or provider names with working movies.

## Safety
Do not clear Android app data, reset Fire Stick, uninstall original Lampa/SmartTube, or change launchers as part of source fixes.
