# Sergey Online — source inventory

## Goal
One separate "Sergey Online" button in Lampa. Inside: a single native Lampa online screen with Source / Filter / Search.

Requirements:
- Merge real video providers found across all supplied plugins.
- Preserve provider-specific cookies, mirrors, device IDs, headers, CORS/native/RCH behavior.
- Remove duplicate aliases from the user-facing list.
- Do not use Internet Archive/Open JSON placeholder code.
- Do not require Telegram/Showy bot/trial/payment flows.
- Do not bypass paid authentication. Providers that return paywall/Telegram/auth must be hidden or marked unavailable.
- Prefer a provider-specific direct adapter when available; server aggregators are fallback.

## Supplied file families

### Online MOD (direct client-side adapters)
Observed provider IDs:
lumex, lumex2, rezka2, kinobase, collaps, collaps-dash, cdnmovies, filmix,
zetflix, fancdn, fancdn2, fanserials, videoseed, vibix, redheadsound,
redheadsound-dash, cdnvideohub, anilibria, anilibria2, animelib, kodik,
alloha, kinopub.

Important state found:
online_mod_rezka2_cookie, online_mod_kinobase_cookie, online_mod_fancdn_cookie,
online_mod_fancdn_token, filmix_token, mirror settings, per-provider proxy settings,
prefer_http/mp4/dash, per-provider choice/filter state and Android native headers.

### VOD / Lampac dynamic backend
Provider IDs from balansers_sync:
filmix, filmixtv, fxapi, rezka, rhsprem, lumex, videodb, collaps, collaps-dash,
hdvb, zetflix, kodik, ashdi, kinoukr, kinotochka, remux, iframevideo,
cdnmovies, anilibria, animedia, animego, animevost, animebesst, redheadsound,
alloha, animelib, moonanime, kinopub, vibix, vdbmovies, fancdn, cdnvideohub,
vokino, rc/filmix, rc/fxapi, rc/rhs, vcdn, videocdn, mirage, hydraflix,
videasy, vidsrc, movpi, vidlink, twoembed, autoembed, smashystream, rgshows,
pidtor, videoseed, iptvonline, veoveo.

The supplied old backend http://hdpoisk.ru:2053 is currently unreliable/hanging in live tests.

### Smotret24 / Showy-derived aggregator
Provider IDs from balansers_sync:
filmix, filmixtv, fxapi, filmixrezka, rezka, pizdatoehd, getstv, kinopub,
zetflixdb, collaps, hdvb, kodik, bamboo, eneyida, kinoukr, uafilm, uakino,
kinotochka, remux, anilibria, animedia, animego, animevost, animebesst,
alloha, mirage, phantom, animelib, moonanime, vibix, fancdn, cdnvideohub,
vokino, hydraflix, videasy, vidsrc, movpi, vidlink, smashystream, autoembed,
pidtor, videoseed, iptvonline, veoveo, kinoflix, leproduction, vkmovie,
kinogo, kinobase, asiage, geosaitebi, mikai, dreamerscast.

Marketing/Telegram/trial/payment runtime must not be copied. The plain video backend
http://smotret24.ru works without Telegram for at least part of its provider set.

### Filmix FX
Standalone Filmix implementation with:
fxapi_uid, fxapi_proxy, fxapi_token, fxapi_status, season/voice/quality parsing.
Free mode exists; token is optional and must never be auto-filled.

### Cinema / AB backend
https://ab2024.ru exposes many providers. It returns a broad source list, but many
direct provider calls currently answer with accsdb/Telegram authorization. Those
must not be presented as working and no auth bypass should be attempted.

### NUMParser
This supplied file is a catalog/category source, not a video balancer. It should
not be mixed into the online video source picker.

## Live tests already performed
ab2024 /lite/withsearch returned:
animedia, aniliberty, anilibria, animelib, animebesst, ailiberty, animevost,
animego, kodik, filmix, filmixtv, fxapi, kinopub, alloha, rezka, remux,
kinoukr, pizdatoehd, kinobase, hdvb, collaps, collaps-dash, vkmovie, veoveo,
rutubemovie, kinotochka, pidtor.

For Interstellar, ab2024 lifeevents listed 27 providers. Direct tests showed that
most provider endpoints returned Telegram authorization; pidtor returned usable HTML.

smotret24 /lite/withsearch returned:
hdvb, rutubemovie, vkmovie, veoveo, filmix, filmixtv, fxapi, filmixrezka, kodik.

For Interstellar, direct endpoint tests returned real playable payloads from:
fxapi (Filmix), hdvb, rutubemovie, vkmovie, vibix.

## User-facing canonicalization
Examples:
- Filmix: direct Filmix/Filmix FX/smotret24 fxapi are fallbacks for one user-facing source.
- Rezka: HDRezka/rezka/filmixrezka aliases should be merged.
- Collaps + Collaps DASH should be one source with transport/quality handled internally.
- rc/* aliases should not appear as separate sources.
- FanCDN/FanSerials variants should be grouped.
- Duplicate server aliases must be hidden.

## Testing strategy
1. Static JS syntax test.
2. Lampa API smoke checks: component registration, button registration, Activity push.
3. Backend integration probes against several movies/series.
4. Reject source responses containing accsdb, Telegram, subscription/paywall, 401/403.
5. Verify server payload contains playable/link/call items.
6. Run locally in official lampa-source (npm run start -> localhost:3000) for UI smoke testing.
7. Final Android/Fire Stick check is still required for native-header/cookie-only providers.
