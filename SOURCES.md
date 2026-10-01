# Источники Sergey Online

Аудит выполнен по всем присланным исходникам и по облачному backend
`https://sergey-online-backend.onrender.com` (исходники: `lampa-sergey-backend-cloud`).

## Что реально подключено

Backend публикует **78 настроенных провайдеров**:

`kinotochka, kinobase, rezka, rhsprem, ahuerezka, filmix, collaps,
collaps-dash, lift, redheadsound, vdbmovies, ashdi, eneyida, kinogo,
kinovod, fancdn, kinoukr, zetflix, cdnmovies, vibix, turbo, zona,
videoseed, mirage, rutubemovie, anwap, rudub, anidub, zagonka, smotrim,
vkmovie, anilibria, aniliberty, animevost, animelib, kodik, animebesst,
animedia, moonanime, vokino, videodb, zetflixdb, uakino, kinopub, veoveo,
hdvb, animego, getstv, iframevideo, cdnvideohub, kubikvkube, remux,
mirkino, aladdin, pidtor, bamboo, uafilm, vidlink, videasy, hydraflix,
twoembed, unimay, starlight, klonfun, uaflix, animeon, mikai, lumex,
gencit, femd, kinobadi, alloha, leproduction, flixcdn, sakhtv, scts,
kbteam, krasview`.

Дополнительные динамические модули backend автоматически добавляют, например,
`uafilmme, awmzone, kinoteatrkg, tevas`, когда они доступны.

## Что было найдено в присланных файлах

Общий набор имён/алиасов включал Filmix/FilmixTV/FXAPI/FilmixRezka,
Rezka, Collaps, HDVB, VideoDB, Kodik, Lumex, Zetflix, Ashdi, KinoUKR,
UAFilm/UAFliX/UAKino, CDNMovies/CDNVideoHub, FanCDN, Alloha, KinoPub,
Vibix, VDBMovies, VoKino, VideoCDN/VCDN, Mirage, Hydraflix, VidSrc,
VidLink, TwoEmbed, AutoEmbed, SmashyStream, RGShows, VideoSeed и другие.

Не каждое имя является отдельным видеохостингом. Часть — алиасы одного и того
же backend-а или старые названия (`filmixrezka`, `rc/filmix`,
`collaps-dash` и т.п.). Они не дублируются в интерфейсе как новые
«источники», если это та же реализация.

## Runtime-проверка 2026-10-01

- `/lite/withsearch`: 78 настроенных источников.
- `/lite/events`: 81 запись с учётом динамических модулей.
- **The Matrix**: 71 обнаружен, 29 активны.
- **Breaking Bad**: 72 обнаружено, 21 активен.
- **Любовная магия (2021)**: 72 обнаружено, 22 активны.
- Публичный GitHub Pages плагин + Chrome: **70 строк** в меню «Источник».
- Публичный GitHub Pages плагин + FireTV/Silk UA: **70 строк** в меню «Источник».

В FireTV-тесте присутствовали Filmix, PidoRezka, Collaps, Kodik, Lumex,
HDVB, UAFliX, UaKino, VideoDB, Mirage, Aladdin, Vkmovie, Kinobase, Zona,
Vibix, Kinovod, Turbo, Femd, Kinobadi, FlixCDN, Zetflix, CDNMovies,
Hydraflix, VidLink, Videasy, TwoEmbed и другие.

Доступность конкретного источника зависит от фильма, региона и состояния
внешнего сервиса. Sergey Online не обходит платную/Telegram-авторизацию:
если провайдер требует закрытый доступ, backend не должен подменять или
обходить его.

## Аудит всех присланных файлов

Повторно проверены все 7 исходников из переписки: два варианта Online MOD,
VOD/Lampac, Showy/Smotret24, standalone Filmix, NUMParser/NMPRS и
обфусцированный Cinema/Lampac. Общий seed-инвентарь клиента содержит 101
уникальный идентификатор/алиас. Cloud backend содержит 81 provider/dynamic key и публикует 78 через /lite/withsearch; /lite/events дополняет
список динамическими модулями.

В клиент не переносятся чужие зашитые авторизационные cookies/tokens. Сохраняются
только механизмы обычных cookies/session/headers, которые создаются самим
провайдером или пользователем. Telegram/Showy/PRO/paywall обходов нет.

### Подтверждённый playback

- Collaps на The Matrix: выдаётся backend `/proxy/...`, `Lampa.Player.play()` вызывается.
- Filmix на «Любовная магия»: 41 строка/серия, RCH/NWS обмен проходит через Render.
- Те же два сценария проходят с FireTV/Silk User-Agent.

### Известные внешние ограничения

В логах Render отдельные провайдеры периодически недоступны независимо от Sergey Online: UAKino требует FlareSolverr, старый Pidtor/redapi не резолвится, SCTS-каталог отдаёт 404, UAFilm может зацикливать redirect, Tevas иногда отвечает EOF. Discovery оставляет такие источники неактивными для конкретного запроса; они не считаются подтверждённым playback.
