# Источники Sergey Online

Аудит выполнен по всем присланным исходникам и по self-hosted backend
`~/Projects/lampa-sergey-backend`.

## Что реально подключено

Backend настроен на **78 уникальных локально реализованных провайдеров**:

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

## Runtime-проверка 2026-09-30

- `/lite/withsearch`: 78 настроенных источников.
- `/lite/events`: 81 запись с учётом динамических модулей.
- **The Matrix**: 71 обнаружен, 29 активны.
- **Breaking Bad**: 72 обнаружено, 23 активны.
- **Любовная магия (2021)**: 72 обнаружено, 23 активны.
- Реальная Lampa + Chrome: **69 строк** в меню «Источник».
- Реальная Lampa + FireTV/Silk UA: **69 строк** в меню «Источник».

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
уникальный идентификатор/алиас. Self-hosted backend реализует 81 локальный
provider key и публикует 78 через /lite/withsearch; /lite/events дополняет
список динамическими модулями.

В клиент не переносятся чужие зашитые авторизационные cookies/tokens. Сохраняются
только механизмы обычных cookies/session/headers, которые создаются самим
провайдером или пользователем. Telegram/Showy/PRO/paywall обходов нет.
