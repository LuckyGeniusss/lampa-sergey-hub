# Источники Sergey Online

Sergey Online использует self-hosted агрегатор. В исходном коде backend присутствуют реализации для большого набора источников; runtime-список зависит от доступности конкретного источника и фильма.

## Поиск / runtime discovery

На текущем локальном backend `/lite/withsearch` возвращает, среди прочего:

- kinotochka
- kinopub
- lumex
- filmix / filmixtv / fxapi
- rezka / rhsprem
- kodik
- remux
- kinoukr
- vcdn / videocdn
- collaps / collaps-dash
- hdvb
- alloha
- veoveo
- rutubemovie
- vkmovie
- videoseed
- mirage
- aladdin
- pidtor
- bamboo
- uaflix / uakino
- animeon / anidub
- mikai
- leproduction
- femd
- kinobadi
- cdnvideohub
- kubikvkube
- lift
- zetflixdb
- smotrim

## Реализации, найденные в backend

Также есть отдельные модули/адаптеры для:

ahuerezka, aladdin, alloha, anidub, aniliberty, anilibria, animebesst,
animedia, animego, animelib, animeon, animevost, anivids, anwap, ashdi,
bamboo, cdnmovies, cdnvideohub, collaps, eneyida, fancdn, femd, filmix,
filmixtv, flixcdn, fxapi, gencit, getstv, hdvb, iframevideo, iptvonline,
kbteam, kinobadi, kinobase, kinogo, kinopub, kinotochka, kinoukr, kinovod,
klonfun, kodik, krasview, kubikvkube, leproduction, lift, lumex, mikai,
mirage, mirkino, moonanime, plvideo, redheadsound, remux, rezka, rudub,
rutubemovie, sakhtv, scts, smotrim, starlight, uafilm, uaflix, uakino,
unimay, vdbmovies, veoveo, vibix, videocdn, videodb, videoseed, vkmovie,
vokino, zagonka, zetflix, zona и другие вспомогательные/browser-модули.

## Тест 30.09.2026

Автоматический smoke-test локального backend:

- `The Matrix`: discovery 49, active 10; рабочие ответы получены как минимум от `vkmovie`, `collaps`, `collaps-dash`, `femd`, `kinobadi`, `krasview`, `lift`.
- `Breaking Bad`: discovery 50, active 6; рабочие ответы получены от `collaps`, `collaps-dash`, `krasview`, `filmix`.
- `Любовная магия` (2021): discovery 49, active 7; рабочие ответы получены от `collaps`, `collaps-dash`, `filmix`.

Пустой ответ одного провайдера для конкретного фильма не считается ошибкой всего агрегатора.
