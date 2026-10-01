# Sergey Online for Lampa

Один плагин Lampa + облачный multi-source backend на Render.

## Подключение в Lampa

`https://luckygeniusss.github.io/lampa-sergey-hub/js`

Плагин добавляет отдельную кнопку **Sergey Online**. Backend по умолчанию:

`https://sergey-online-backend.onrender.com`

Старые локальные адреса `10.129.1.x:18118`, `hdpoisk` и `ab2024.ru` мигрируются автоматически. Пользовательский backend можно задать в `Настройки -> Sergey Online -> Сервер`.

## Что внутри

- отдельная кнопка Sergey Online;
- родной экран Lampa: **Источник / Фильтр / сезоны / озвучки / серии**;
- динамический список источников через `/lite/events` + `/lifeevents`;
- cookies/session/header/RCH-логика backend сохраняется;
- дубли/legacy-алиасы не выдаются как отдельные реализации;
- Telegram/Showy/paywall обходы не используются;
- облачный HTTPS backend не зависит от IP или состояния Mac mini.

Текущий backend публикует **78 настроенных источников** и дополнительные динамические модули. Клиентский seed-инвентарь содержит 101 уникальный ID/алиас.

## Проверка

```bash
cd ~/Projects/lampa-sergey-hub
npm run test:cloud
./scripts/healthcheck.sh
```

`npm run test:cloud` проверяет публичный Render backend, discovery, опубликованный GitHub Pages плагин, Lampa в Chrome и с FireTV/Silk User-Agent, а также реальное открытие Collaps и Filmix.

Последняя проверка 2026-10-01:

- `/healthz` и `/version`: HTTP 200, `Alpac 0.5`;
- `/lite/withsearch`: 78 источников;
- `/lite/events`: 81 запись;
- The Matrix: 71 обнаружен, 29 активны;
- Breaking Bad: 72 обнаружено, 21 активен;
- «Любовная магия»: 72 обнаружено, 22 активны;
- публичная Lampa: 70 строк источников в Chrome и FireTV/Silk;
- Collaps: получен реальный proxy URL и вызван `Lampa.Player.play()`;
- Filmix: «Любовная магия» возвращает 41 строку/серию;
- FireTV/Silk playback-smoke: PASS для Collaps и Filmix.

Доступность конкретного источника зависит от фильма, региона и состояния внешнего сервиса. Недоступные на конкретном запросе источники backend помечает как неактивные/ghost.
