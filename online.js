(function () {
    'use strict';

    if (window.sergey_online_ready) return;
    window.sergey_online_ready = true;

    var NAME = 'Sergey Online';
    var VERSION = '0.3.0';
    var BUTTON_CLASS = 'view--sergey-online';
    var providers = [];

    function log() {
        var args = Array.prototype.slice.call(arguments);
        args.unshift('[SergeyOnline]');
        try { console.log.apply(console, args); } catch (e) {}
    }

    function notify(text) {
        try {
            if (Lampa.Noty && Lampa.Noty.show) Lampa.Noty.show(text);
        } catch (e) {}
    }

    function storage(name, fallback) {
        try {
            var value = Lampa.Storage.get(name);
            return value === undefined || value === null || value === '' ? fallback : value;
        } catch (e) {
            return fallback;
        }
    }

    function boolSetting(name, fallback) {
        var value = storage(name, fallback);
        return value !== false && value !== 'false' && value !== 0 && value !== '0';
    }

    function movieTitle(movie) {
        return (movie && (movie.title || movie.name || movie.original_title || movie.original_name)) || '';
    }

    function originalTitle(movie) {
        return (movie && (movie.original_title || movie.original_name || movie.title || movie.name)) || '';
    }

    function movieYear(movie) {
        var value = movie && (movie.release_date || movie.first_air_date || movie.last_air_date || movie.year || '');
        var match = String(value).match(/\d{4}/);
        return match ? match[0] : '';
    }

    function movieIds(movie) {
        movie = movie || {};
        return {
            tmdb_id: movie.id || movie.tmdb_id || '',
            imdb_id: movie.imdb_id || movie.imdb || '',
            kp_id: movie.kinopoisk_id || movie.kp_id || movie.kp || ''
        };
    }

    function normalize(value) {
        return String(value || '')
            .toLowerCase()
            .replace(/ё/g, 'е')
            .replace(/[^a-z0-9а-яіїєґ]+/gi, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function requestText(url, timeout) {
        return new Promise(function (resolve, reject) {
            var network = new Lampa.Reguest();
            try { network.timeout(timeout || 15000); } catch (e) {}

            network.silent(
                url,
                function (data) {
                    if (typeof data === 'string') return resolve(data);
                    try { resolve(JSON.stringify(data)); }
                    catch (e) { resolve(String(data || '')); }
                },
                function (a, c) {
                    var message = '';
                    try { message = network.errorDecode(a, c); } catch (e) {}
                    reject(new Error(message || 'network error'));
                },
                false,
                { dataType: 'text' }
            );
        });
    }

    function requestJson(url, timeout) {
        return requestText(url, timeout).then(function (text) {
            if (typeof text === 'object') return text;
            return JSON.parse(text);
        });
    }

    function qualityScore(value) {
        value = String(value || '').toLowerCase();
        if (/2160|4k/.test(value)) return 4000;
        if (/1440|2k/.test(value)) return 3000;
        if (/1080|full.?hd/.test(value)) return 2000;
        if (/720|hd/.test(value)) return 1500;
        if (/480/.test(value)) return 1000;
        if (/360/.test(value)) return 500;
        return 0;
    }

    function normalizeResult(item, provider) {
        item = item || {};
        return {
            provider: item.provider || provider.name,
            provider_id: provider.id,
            title: item.title || item.name || provider.name,
            subtitle: item.subtitle || '',
            url: item.url || item.file || '',
            quality: item.quality || '',
            voice: item.voice || item.translation || '',
            season: item.season || '',
            episode: item.episode || '',
            headers: item.headers || null,
            subtitles: item.subtitles || null
        };
    }

    function dedupe(items) {
        var seen = {};
        var out = [];
        items.forEach(function (item) {
            var key = String(item.url || '') + '|' + String(item.quality || '') + '|' + String(item.voice || '');
            if (!item.url || seen[key]) return;
            seen[key] = true;
            out.push(item);
        });
        return out;
    }

    function registerProvider(provider) {
        if (!provider || !provider.id || !provider.name || typeof provider.search !== 'function') return false;
        for (var i = 0; i < providers.length; i++) {
            if (providers[i].id === provider.id) {
                providers[i] = provider;
                return true;
            }
        }
        providers.push(provider);
        return true;
    }

    function providerEnabled(provider) {
        return boolSetting(provider.setting, provider.default_enabled !== false);
    }

    function runProvider(provider, movie) {
        return new Promise(function (resolve) {
            var done = false;
            var timer = setTimeout(function () {
                if (done) return;
                done = true;
                resolve({ provider: provider, ok: false, error: 'timeout', items: [] });
            }, provider.timeout || 20000);

            Promise.resolve().then(function () {
                return provider.search(movie);
            }).then(function (items) {
                if (done) return;
                done = true;
                clearTimeout(timer);
                items = Array.isArray(items) ? items : [];
                resolve({
                    provider: provider,
                    ok: true,
                    error: '',
                    items: items.map(function (item) { return normalizeResult(item, provider); })
                });
            }).catch(function (error) {
                if (done) return;
                done = true;
                clearTimeout(timer);
                resolve({
                    provider: provider,
                    ok: false,
                    error: String(error && error.message ? error.message : error),
                    items: []
                });
            });
        });
    }

    function searchInternetArchive(movie) {
        var title = originalTitle(movie) || movieTitle(movie);
        var year = movieYear(movie);
        if (!title) return Promise.resolve([]);

        var query = 'title:(' + title.replace(/[():"']/g, ' ') + ') AND mediatype:(movies)';
        var url = 'https://archive.org/advancedsearch.php?q=' + encodeURIComponent(query) +
            '&fl%5B%5D=identifier&fl%5B%5D=title&fl%5B%5D=year&rows=12&page=1&output=json';

        return requestJson(url, 15000).then(function (data) {
            var docs = data && data.response && data.response.docs ? data.response.docs : [];
            var wanted = normalize(title);

            docs = docs.map(function (doc) {
                var score = 0;
                var current = normalize(doc.title || '');
                if (current === wanted) score += 100;
                else if (current.indexOf(wanted) >= 0 || wanted.indexOf(current) >= 0) score += 50;
                if (year && String(doc.year || '').indexOf(year) >= 0) score += 40;
                doc.__score = score;
                return doc;
            }).sort(function (a, b) {
                return b.__score - a.__score;
            }).slice(0, 5);

            return Promise.all(docs.map(function (doc) {
                return requestJson('https://archive.org/metadata/' + encodeURIComponent(doc.identifier), 15000)
                    .then(function (meta) {
                        var files = meta && meta.files ? meta.files : [];
                        var result = [];

                        files.forEach(function (file) {
                            var name = file && file.name ? String(file.name) : '';
                            if (!/\.(mp4|m4v)$/i.test(name)) return;
                            if (/thumb|sample|trailer|preview/i.test(name)) return;

                            var q = '';
                            var qm = name.match(/(2160p|1440p|1080p|720p|480p|360p|4k)/i);
                            if (qm) q = qm[1].toUpperCase();

                            result.push({
                                title: doc.title || movieTitle(movie),
                                subtitle: 'Internet Archive' + (doc.year ? ' • ' + doc.year : '') + ' • ' + name,
                                url: 'https://archive.org/download/' + encodeURIComponent(doc.identifier) + '/' + encodeURIComponent(name).replace(/%2F/gi, '/'),
                                quality: q
                            });
                        });

                        result.sort(function (a, b) {
                            return qualityScore(b.quality) - qualityScore(a.quality);
                        });
                        return result.slice(0, 5);
                    }).catch(function () { return []; });
            })).then(function (groups) {
                var all = [];
                groups.forEach(function (group) { all = all.concat(group); });
                return all;
            });
        });
    }

    function searchOpenJson(movie) {
        var endpoint = String(storage('sergey_online_json_url', '') || '').trim();
        if (!endpoint || !/^https?:\/\//i.test(endpoint)) return Promise.resolve([]);

        var ids = movieIds(movie);
        var params = [
            'title=' + encodeURIComponent(movieTitle(movie)),
            'original_title=' + encodeURIComponent(originalTitle(movie)),
            'year=' + encodeURIComponent(movieYear(movie)),
            'tmdb_id=' + encodeURIComponent(ids.tmdb_id),
            'imdb_id=' + encodeURIComponent(ids.imdb_id),
            'kp_id=' + encodeURIComponent(ids.kp_id)
        ].join('&');

        var url = endpoint + (endpoint.indexOf('?') >= 0 ? '&' : '?') + params;

        return requestJson(url, 16000).then(function (data) {
            var list = Array.isArray(data) ? data : (data && Array.isArray(data.results) ? data.results : []);
            var out = [];

            list.forEach(function (item) {
                if (!item) return;

                if (item.quality && typeof item.quality === 'object' && !Array.isArray(item.quality)) {
                    Object.keys(item.quality).forEach(function (q) {
                        out.push({
                            title: item.title || movieTitle(movie),
                            subtitle: item.subtitle || '',
                            url: item.quality[q],
                            quality: q,
                            voice: item.voice || item.translation || '',
                            headers: item.headers || null,
                            subtitles: item.subtitles || null,
                            season: item.season || '',
                            episode: item.episode || ''
                        });
                    });
                } else if (item.url || item.file) {
                    out.push(item);
                }
            });

            return out;
        });
    }

    registerProvider({
        id: 'archive',
        name: 'Internet Archive',
        setting: 'sergey_online_archive',
        default_enabled: true,
        timeout: 20000,
        search: searchInternetArchive
    });

    registerProvider({
        id: 'open_json',
        name: 'Open JSON API',
        setting: 'sergey_online_json',
        default_enabled: false,
        timeout: 20000,
        search: searchOpenJson
    });

    function play(item, movie) {
        if (!item || !item.url) return;
        try { Lampa.Select.close(); } catch (e) {}

        var data = {
            url: item.url,
            title: movieTitle(movie),
            quality: 'auto'
        };
        if (item.headers) data.headers = item.headers;
        if (item.subtitles) data.subtitles = item.subtitles;

        try {
            Lampa.Player.play(data);
            if (Lampa.Player.playlist) Lampa.Player.playlist([data]);
        } catch (e) {
            notify('Sergey Online: ошибка запуска видео');
            log('player error', e);
        }
    }

    function showResults(movie, results) {
        var all = [];
        var failed = [];

        results.forEach(function (result) {
            if (!result.ok) failed.push(result.provider.name);
            all = all.concat(result.items || []);
        });

        all = dedupe(all);
        all.sort(function (a, b) {
            var qa = qualityScore(a.quality);
            var qb = qualityScore(b.quality);
            if (qa !== qb) return qb - qa;
            return String(a.provider).localeCompare(String(b.provider));
        });

        if (!all.length) {
            var msg = 'Sergey Online: ничего не найдено';
            if (failed.length) msg += ' • не ответили: ' + failed.join(', ');
            notify(msg);
            return;
        }

        var items = all.map(function (item) {
            var info = [item.provider];
            if (item.quality) info.push(item.quality);
            if (item.voice) info.push(item.voice);
            if (item.season) info.push('S' + item.season);
            if (item.episode) info.push('E' + item.episode);
            if (item.subtitle) info.push(item.subtitle);

            return {
                title: item.title || movieTitle(movie),
                subtitle: info.join(' • '),
                sergey_item: item
            };
        });

        Lampa.Select.show({
            title: NAME + ' — ' + movieTitle(movie),
            items: items,
            onSelect: function (selected) {
                play(selected.sergey_item, movie);
            },
            onBack: function () {
                try { Lampa.Controller.toggle('content'); } catch (e) {}
            }
        });
    }

    function open(movie) {
        movie = movie || {};
        var active = providers.filter(providerEnabled);

        if (!active.length) {
            notify('Sergey Online: включите источник в настройках');
            return;
        }

        notify('Sergey Online: поиск в ' + active.length + ' источниках…');

        Promise.all(active.map(function (provider) {
            return runProvider(provider, movie);
        })).then(function (results) {
            showResults(movie, results);
        }).catch(function (e) {
            notify('Sergey Online: ошибка поиска');
            log('searchAll error', e);
        });
    }

    function buttonHtml() {
        return '<div class="full-start__button selector ' + BUTTON_CLASS + '" data-subtitle="' + NAME + ' ' + VERSION + '">' +
            '<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">' +
            '<circle cx="16" cy="16" r="13" stroke="currentColor" stroke-width="2.5"/>' +
            '<path d="M13 10.5L23 16L13 21.5V10.5Z" fill="currentColor"/>' +
            '</svg><span>' + NAME + '</span></div>';
    }

    function installFullButton(e) {
        if (!e || e.type !== 'complite' || !e.object || !e.object.activity || !e.data || !e.data.movie) return;

        try {
            var root = e.object.activity.render();
            var container = root.find('.buttons--container');
            if (!container.length) return;

            container.find('.' + BUTTON_CLASS).remove();

            var button = $(buttonHtml());
            button.on('hover:enter', function () {
                open(e.data.movie);
            });

            var torrent = container.find('.view--torrent');
            if (torrent.length) torrent.after(button);
            else container.prepend(button);
        } catch (error) {
            log('install button error', error);
        }
    }

    function addSettings() {
        if (!Lampa.SettingsApi) return;

        try {
            Lampa.SettingsApi.addComponent({
                component: 'sergey_online',
                name: NAME,
                icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2"/><path d="M10 8L17 12L10 16V8Z" fill="currentColor"/></svg>'
            });
        } catch (e) {}

        try {
            Lampa.SettingsApi.addParam({
                component: 'sergey_online',
                param: { name: 'sergey_online_archive', type: 'trigger', default: true },
                field: {
                    name: 'Internet Archive',
                    description: 'Открытый источник. Нужен также для проверки работы единого поиска.'
                }
            });
        } catch (e) {}

        try {
            Lampa.SettingsApi.addParam({
                component: 'sergey_online',
                param: { name: 'sergey_online_json', type: 'trigger', default: false },
                field: {
                    name: 'Open JSON API',
                    description: 'Подключить разрешённый API с прямыми ссылками на видео.'
                }
            });
        } catch (e) {}

        try {
            Lampa.SettingsApi.addParam({
                component: 'sergey_online',
                param: {
                    name: 'sergey_online_json_url',
                    type: 'input',
                    default: '',
                    values: '',
                    placeholder: 'https://example.org/api/search'
                },
                field: {
                    name: 'URL Open JSON API',
                    description: 'GET-параметры: title, original_title, year, tmdb_id, imdb_id, kp_id.'
                }
            });
        } catch (e) {}

        try {
            Lampa.SettingsApi.addParam({
                component: 'sergey_online',
                param: { name: 'sergey_online_version', type: 'static', default: VERSION },
                field: { name: 'Версия', description: VERSION }
            });
        } catch (e) {}
    }

    function init() {
        addSettings();

        Lampa.Manifest.plugins = {
            type: 'video',
            version: VERSION,
            name: NAME,
            description: 'Единый поиск по разрешённым онлайн-источникам',
            onContextMenu: function () {
                return { name: NAME, title: NAME, description: 'Искать онлайн' };
            },
            onContextLauch: function (movie) {
                open(movie);
            }
        };

        Lampa.Listener.follow('full', installFullButton);

        window.SergeyOnline = {
            version: VERSION,
            open: open,
            registerProvider: registerProvider,
            providers: function () { return providers.slice(); }
        };

        log(NAME + ' ' + VERSION + ' ready');
    }

    if (window.appready) init();
    else {
        Lampa.Listener.follow('app', function (e) {
            if (e.type === 'ready') init();
        });
    }
})();