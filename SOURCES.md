# Sergey Online — source inventory

Updated for Sergey Online 0.5.0.

## Direct/native provider engine currently used by /js

The current plugin is based on the provider engine from the supplied Online MOD 14.08.2026 source. It keeps the real Lampa source picker and removes the Internet Archive/Open JSON placeholder implementation.

Provider adapters present in the native engine:
- HDrezka
- Filmix
- Collaps
- FanSerials / FanCDN
- CDNVideoHub
- AniLibria / AniLibria.top
- Kodik
- Lumex
- Kinobase
- CDNMovies
- Zetflix
- VideoSeed
- Vibix
- RedHeadSound
- AnimeLib
- Alloha
- KinoPub

Some adapters are disabled by the upstream engine when they are known to be unavailable, restricted, duplicate, or environment-dependent. Sergey Online does not force-enable those dead/blocked providers.

## Additional provider identifiers found in the supplied competitor plugins

FilmixTV, FXAPI, Rezka, RHS Premium, Lumex, VideoDB, Collaps, HDVB, Zetflix, Kodik, Ashdi, KinoUKR, Kinotochka, Remux, IframeVideo, CDNMovies, AniLibria, AniMedia, AnimeGo, AnimeVost, AnimeBesst, RedHeadSound, Alloha, AnimeLib, MoonAnime, KinoPub, Vibix, VDBMovies, FanCDN, CDNVideoHub, VoKino, VCDN, VideoCDN, Mirage, Hydraflix, Videasy, VidSrc, Movpi, VidLink, TwoEmbed, AutoEmbed, SmashyStream, RGShows, Pidtor, VideoSeed, IPTVOnline, VeoVeo, FilmixRezka, GetsTV, Bamboo, Eneyida, UAFilm, UAKino, Phantom, KinoFlix, LeProduction, VKMovie, KinoGo, Kinobase, AsiaGe, GeoSaitebi, Mikai, DreamersCast.

Aliases/protocol variants are intentionally not shown as separate user-facing sources when they represent the same provider (for example Collaps-DASH, rc/filmix, rc/fxapi, rc/rhs).

## Authentication policy

Sergey Online does not include Showy/Telegram marketing or payment-gateway flows. It does not attempt to bypass provider authentication or paid access. Provider-native public/free access is used where available.
