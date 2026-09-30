# Sergey Online for Lampa

Один плагин Lampa + локальный self-hosted backend с большим набором онлайн-источников.

## Lampa plugin

Добавить в Lampa:

`https://luckygeniusss.github.io/lampa-sergey-hub/js`

Плагин добавляет отдельную кнопку **Sergey Online** и использует backend, указанный в:

`Настройки -> Sergey Online -> Сервер`

Текущий домашний backend по умолчанию:

`http://10.129.1.174:18118`

## Backend

Backend работает на Mac mini и стартует автоматически через launchd:

`~/Library/LaunchAgents/com.sergey.lampa-backend.plist`

Исходники backend находятся отдельно:

`~/Projects/lampa-sergey-backend`

Это self-hosted Lampac/ALPAC-compatible backend. Telegram для локального использования не требуется.

## Проверка

```bash
./scripts/healthcheck.sh
```

Проверка валидирует:
- доступность backend по LAN;
- список поддерживаемых поисковых источников;
- динамический discovery источников для фильма;
- реальные ответы нескольких активных `/lite/*` источников;
- доступность опубликованного GitHub Pages plugin.js.

## Важно

Часть внешних источников может временно переставать работать или требовать собственные токены/прокси. Плагин не должен показывать такой источник как рабочий только потому, что его имя есть в каталоге: фактическая доступность определяется backend во время запроса.
