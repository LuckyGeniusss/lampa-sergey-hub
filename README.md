# Sergey Online for Lampa

Один плагин Lampa + self-hosted backend на Mac mini.

## Подключение в Lampa

`https://luckygeniusss.github.io/lampa-sergey-hub/js`

Плагин добавляет отдельную кнопку **Sergey Online**. Backend на домашней сети:

`http://10.129.1.174:18118`

Адрес можно изменить в `Настройки -> Sergey Online -> Сервер`.

## Что внутри

- отдельная кнопка Sergey Online;
- родной экран Lampa: **Источник / Фильтр / сезоны / озвучки / серии**;
- динамический список источников через `/lite/events` + `/lifeevents`;
- cookies/session/header/RCH-логика backend сохраняется;
- дубли/legacy-алиасы не выдаются как отдельные реализации;
- Telegram/Showy/paywall обходы не используются.

Backend: `~/Projects/lampa-sergey-backend`, launchd:
`~/Library/LaunchAgents/com.sergey.lampa-backend.plist`.

Сейчас backend настроен на **78 уникальных локальных провайдеров**. Дополнительные динамические модули добавляются автоматически. На тесте The Matrix реальная Lampa показала **69 строк источников** и backend отметил **29 источников активными**; на Breaking Bad — 23 активных; на «Любовная магия» (2021) — 23 активных.

## Проверка

```bash
cd ~/Projects/lampa-sergey-hub
npm test
./scripts/healthcheck.sh
```

`npm test` включает статическую проверку плагина, backend API, discovery фильма/сериала/«Любовной магии» и настоящий Playwright-тест на локальной сборке Lampa в обычном Chrome и с FireTV/Silk User-Agent.

Важно: Fire Stick должен видеть Mac mini по адресу `10.129.1.174:18118`. Если IP Mac изменится, нужно обновить поле **Сервер** в настройках Sergey Online или закрепить IP в роутере.
