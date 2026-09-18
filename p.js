(function () {
    'use strict';

    var HUB_ID = 'sergey_online_hub';
    var HUB_NAME = 'Sergey Online Hub';
    var VERSION = '0.1.0';
    var MAX_SLOTS = 8;
    var loaded = {};
    var statuses = {};

    function log() {
        var args = Array.prototype.slice.call(arguments);
        args.unshift('[SergeyHub]');
        try { console.log.apply(console, args); } catch (e) {}
    }

    function notify(text) {
        try {
            if (window.Lampa && Lampa.Noty && Lampa.Noty.show) {
                Lampa.Noty.show(text);
            }
        } catch (e) {}
    }

    function storageGet(name, fallback) {
        try {
            var value = Lampa.Storage.get(name);
            return (value === undefined || value === null || value === '') ? fallback : value;
        } catch (e) {
            return fallback;
        }
    }

    function normalizeUrl(value) {
        value = String(value || '').trim();
        if (!value) return '';
        if (!/^https?:\/\//i.test(value)) return '';
        return value;
    }

    function slotKey(n) {
        return 'sergey_hub_url_' + n;
    }

    function slotEnabledKey(n) {
        return 'sergey_hub_enabled_' + n;
    }

    function providerList() {
        var list = [];
        for (var i = 1; i <= MAX_SLOTS; i++) {
            var url = normalizeUrl(storageGet(slotKey(i), ''));
            var enabled = storageGet(slotEnabledKey(i), true);
            if (url && enabled !== false && enabled !== 'false') {
                list.push({ id: i, name: 'Источник ' + i, url: url });
            }
        }
        return list;
    }

    function withCacheBust(url) {
        var sep = url.indexOf('?') >= 0 ? '&' : '?';
        return url + sep + 'sergey_hub=' + encodeURIComponent(VERSION);
    }

    function loadScript(provider) {
        return new Promise(function (resolve) {
            var url = provider.url;

            if (loaded[url]) {
                statuses[provider.id] = 'loaded';
                resolve({ ok: true, cached: true, provider: provider });
                return;
            }

            statuses[provider.id] = 'loading';

            var script = document.createElement('script');
            script.async = true;
            script.src = withCacheBust(url);
            script.setAttribute('data-sergey-hub-provider', String(provider.id));

            script.onload = function () {
                loaded[url] = true;
                statuses[provider.id] = 'loaded';
                log('Loaded:', provider.name, url);
                resolve({ ok: true, provider: provider });
            };

            script.onerror = function () {
                statuses[provider.id] = 'error';
                log('Failed:', provider.name, url);
                resolve({ ok: false, provider: provider });
            };

            (document.head || document.documentElement).appendChild(script);
        });
    }

    function loadAll(showNotice) {
        var providers = providerList();

        if (!providers.length) {
            if (showNotice) notify('Sergey Online Hub: добавьте ссылки на источники в настройках');
            log('No provider URLs configured');
            return Promise.resolve([]);
        }

        log('Loading providers:', providers.length);

        return Promise.all(providers.map(loadScript)).then(function (results) {
            var ok = results.filter(function (r) { return r.ok; }).length;
            var fail = results.length - ok;

            if (showNotice) {
                notify('Sergey Online Hub: загружено ' + ok + (fail ? ', ошибок ' + fail : ''));
            }

            return results;
        });
    }

    function addSettings() {
        if (!window.Lampa || !Lampa.SettingsApi) return;

        try {
            Lampa.SettingsApi.addComponent({
                component: HUB_ID,
                name: HUB_NAME,
                icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="7" cy="7" r="2" fill="currentColor"/><circle cx="12" cy="12" r="2" fill="currentColor"/><circle cx="17" cy="17" r="2" fill="currentColor"/></svg>'
            });
        } catch (e) {
            log('addComponent:', e);
        }

        try {
            Lampa.SettingsApi.addParam({
                component: HUB_ID,
                param: {
                    name: 'sergey_hub_autoload',
                    type: 'trigger',
                    default: true
                },
                field: {
                    name: 'Автозагрузка источников',
                    description: 'При запуске Lampa загружать все включённые ссылки ниже'
                }
            });
        } catch (e) {}

        for (var i = 1; i <= MAX_SLOTS; i++) {
            (function (n) {
                try {
                    Lampa.SettingsApi.addParam({
                        component: HUB_ID,
                        param: {
                            name: slotEnabledKey(n),
                            type: 'trigger',
                            default: true
                        },
                        field: {
                            name: 'Источник ' + n + ': включён'
                        }
                    });
                } catch (e) {}

                try {
                    Lampa.SettingsApi.addParam({
                        component: HUB_ID,
                        param: {
                            name: slotKey(n),
                            type: 'input',
                            values: '',
                            placeholder: 'https://example.org/plugin.js',
                            default: ''
                        },
                        field: {
                            name: 'Источник ' + n + ': URL плагина',
                            description: 'Прямая HTTPS-ссылка на JS-плагин Lampa'
                        },
                        onChange: function () {
                            notify('Ссылка сохранена. Перезапустите Lampa для загрузки.');
                        }
                    });
                } catch (e) {}
            })(i);
        }

        try {
            Lampa.SettingsApi.addParam({
                component: HUB_ID,
                param: {
                    name: 'sergey_hub_version',
                    type: 'static',
                    default: VERSION
                },
                field: {
                    name: 'Версия',
                    description: VERSION
                }
            });
        } catch (e) {}
    }

    function start() {
        if (!window.Lampa) {
            setTimeout(start, 250);
            return;
        }

        if (window.__SERGEY_ONLINE_HUB_STARTED__) return;
        window.__SERGEY_ONLINE_HUB_STARTED__ = true;

        addSettings();

        window.SergeyOnlineHub = {
            version: VERSION,
            list: providerList,
            loadAll: function () { return loadAll(true); },
            load: function (url) {
                url = normalizeUrl(url);
                if (!url) return Promise.resolve({ ok: false, error: 'invalid_url' });
                return loadScript({ id: 'manual', name: 'Ручной источник', url: url });
            },
            status: function () { return JSON.parse(JSON.stringify(statuses)); }
        };

        var autoload = storageGet('sergey_hub_autoload', true);
        if (autoload !== false && autoload !== 'false') {
            setTimeout(function () { loadAll(false); }, 800);
        }

        log(HUB_NAME + ' v' + VERSION + ' started');
    }

    start();
})();