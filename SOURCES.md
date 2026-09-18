# Sergey Online — providers (v0.6.0)

This build uses the full dynamic VOD/Lampac source engine. The Source menu is populated from the live `lite/events?life=true` / `lifeevents` response, not from a hard-coded four-provider list.

Provider identifiers preserved from the supplied plugins:

filmix, filmixtv, fxapi, filmixrezka, rezka, rhsprem, pizdatoehd, getstv,
lumex, videodb, collaps, collaps-dash, hdvb, zetflix, zetflixdb, kodik,
ashdi, kinoukr, uafilm, uakino, kinotochka, remux, iframevideo, cdnmovies,
anilibria, animedia, animego, animevost, animebesst, redheadsound, alloha,
animelib, moonanime, kinopub, vibix, vdbmovies, fancdn, cdnvideohub, vokino,
vcdn, videocdn, mirage, hydraflix, videasy, vidsrc, movpi, vidlink, twoembed,
autoembed, smashystream, rgshows, pidtor, videoseed, iptvonline, veoveo,
bamboo, eneyida, phantom, kinoflix, leproduction, vkmovie, kinogo, kinobase,
asiage, geosaitebi, mikai, dreamerscast.

The original `lampac_unic_id`, `online_choice_*`, RCH/native-request and other
source/session state are deliberately preserved. Unavailable providers are not
faked as working: runtime availability comes from the backend's live source list.

Showy/Telegram marketing, Yandex analytics and DonationAlerts UI are not included.
