(function () {
    'use strict';

    var ID = 'sergey_unified_online';
    var NAME = 'Sergey Online';
    var VERSION = '0.2.0';
    var providers = [];
    var started = false;

    function log() {
        var args = Array.prototype.slice.call(arguments);
        args.unshift('[SergeyOnline]');
        try { console.log.apply(console, args); } catch (e) {}
    }

    function notify(text) {
        try {
            if (window.Lampa && Lampa.Noty && Lampa.Noty.show) Lampa.Noty.show(text);
        } catch (e) {}
    }

    function getStorage(key, fallback) {
        try {
            var value = Lampa.Storage.get(key);
            return value === undefined || value === null || value === '' ? fallback : value;
        } catch (e) {
            return fallback;
        }
    }

    function isEnabled(key, fallback) {
        var value = getStorage(key, fallback);
        return value !== false && value !== 'false' && value !== 0 && value !== '0';
    }

    function yearOf(movie) {
        var date = movie && (movie.release_date || movie.first_air_date || movie.year || '');
        var match = String(date).match(/\d{4}/);
        return match ? match[0] : '';
    }

    function movieTitle(movie) {
        return (movie && (movie.title || movie.name || movie.original_title || movie.original_name)) || '';
    }

    function originalTitle(movie) {
        return (movie && (movie.original_title || movie.original_name || movie.title || movie.name)) || '';
    }

    function idsOf(movie) {
        movie = movie || {};
        return {
            tmdb: movie.id || movie.tmdb_id || '',
            imdb: movie.imdb_id || movie.imdb || '',
            kp: movie.kinopoisk_id || movie.kp_id || movie.kp || ''
        };
    }

    function normalizeText(value) {
        return String(value || '')
            .toLowerCase()
            .replace(/[ё]/g, 'е')
            .replace(/[^a-z0-9а-яіїєґ]+/gi, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function requestText(url, timeout) {
        return new Promise(function (resolve, reject) {
            var net = new Lampa.Reguest();
            try { net.timeout(timeout || 15000); } catch (e) {}
            net.silent(
                url,
                function (data) {
                    if (typeof data === 'string') resolve(data);
                    else {
                        try { resolve(JSON.stringify(data)); }
                        catch (e) { resolve(String(data || '')); }
                    }
                },
                function (err) { reject(err || new Error('network')); },
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

    function withTimeout(promise, ms, name) {
        return new Promise(function (resolve) {
            var done = false;
            var timer = setTimeout(function () {
                if (done) return;
                done = true;
                resolve({ ok: false, provider: name, error: 'timeout', items: [] });
            }, ms || 18000);

            Promise.resolve(promise).then(function (items) {
                if (done) return;
                done = true;
                clearTimeout(timer);
                resolve({ ok: true, provider: name, items: Array.isArray(items) ? items : [] });
            }).catch(function (e) {
                if (done) return;
                done = true;
                clearTimeout(timer);
                resolve({ ok: false, provider: name, error: String(e && e.message ? e.message : e), items: [] });
            });
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

    function normalizeItem(item, provider) {
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
            subtitles: item.subtitles || null,
            direct: item.direct !== false,
            raw: item
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
        if (!provider || !provider.id || typeof provider.search !== 'function') return false;
        for (var i = 0; i < providers.length; i++) {
            if (providers[i].id === provider.id) {
                providers[i] = provider;
                return true;
            }
        }
        providers.push(provider);
        return true;
    }

    function archiveSearch(movie) {
        var title = movieTitle(movie);
        var original = originalTitle(movie);
        var year = yearOf(movie);
        var queryTitle = original || title;
        if (!queryTitle) return Promise.resolve([]);

        var q = 'title:("' + queryTitle.replace(/"/g, '') + '") AND mediatype:(movies)';
        if (year) q += ' AND year:[' + year + ' TO ' + year + ']';

        var url = 'https://archive.org/advancedsearch.php?q=' + encodeURIComponent(q) +
            '&fl%5B%5D=identifier&fl%5B%5D=title&fl%5B%5D=year&rows=8&page=1&output=json';

        return requestJson(url, 15000).then(function (data) {
            var docs = data && data.response && data.response.docs ? data.response.docs : [];
            if (!docs.length && year) {
                var q2 = 'title:("' + queryTitle.replace(/"/g, '') + '") AND mediatype:(movies)';
                var url2 = 'https://archive.org/advancedsearch.php?q=' + encodeURIComponent(q2) +
                    '&fl%5B%5D=identifier&fl%5B%5D=title&fl%5B%5D=year&rows=8&page=1&output=json';
                return requestJson(url2, 15000).then(function (d2) {
                    return d2 && d2.response && d2.response.docs ? d2.response.docs : [];
                });
            }
            return docs;
        }).then(function (docs) {
            var wanted = normalizeText(original || title);
            docs = docs.map(function (doc) {
                var score = 0;
                var dt = normalizeText(doc.title || '');
                if (dt === wanted) score += 100;
                else if (dt.indexOf(wanted) >= 0 || wanted.indexOf(dt) >= 0) score += 50;
                if (year && String(doc.year || '').indexOf(year) >= 0) score += 40;
                doc.__score = score;
                return doc;
            }).sort(function (a, b) { return b.__score - a.__score; }).slice(0, 4);

            return Promise.all(docs.map(function (doc) {
                var metaUrl = 'https://archive.org/metadata/' + encodeURIComponent(doc.identifier);
                return requestJson(metaUrl, 15000).then(function (meta) {
                    var files = meta && meta.files ? meta.files : [];
                    var results = [];
                    files.forEach(function (file) {
                        var name = file && file.name ? String(file.name) : '';
                        if (!/\.(mp4|m4v)$/i.test(name)) return;
                        if (/thumb|sample|trailer|preview/i.test(name)) return;
                        var direct = 'https://archive.org/download/' + encodeURIComponent(doc.identifier) + '/' + encodeURIComponent(name).replace(/%2F/gi, '/');
                        var ql = '';
                        var qm = name.match(/(2160p|1440p|1080p|720p|480p|360p|4k)/i);
                        if (qm) ql = qm[1].toUpperCase();
                        results.push({
                            title: doc.title || name,
                            subtitle: 'Internet Archive' + (doc.year ? ' • ' + doc.year : '') + (name ? ' • ' + name : ''),
                            url: direct,
                            quality: ql,
                            direct: true
                        });
                    });
                    results.sort(function (a, b) { return qualityScore(b.quality) - qualityScore(a.quality); });
                    return results.slice(0, 4);
                }).catch(function () { return []; });
            })).then(function (groups) {
                var all = [];
                groups.forEach(function (g) { all = all.concat(g); });
                return all;
            });
        });
    }

    function genericJsonSearch(movie) {
        var endpoint = String(getStorage('sergey_unified_json_url', '') || '').trim();
        if (!endpoint || !/^https?:\/\//i.test(endpoint)) return Promise.resolve([]);

        var ids = idsOf(movie);
        var params = [
            'title=' + encodeURIComponent(movieTitle(movie)),
            'original_title=' + encodeURIComponent(originalTitle(movie)),
            'year=' + encodeURIComponent(yearOf(movie)),
            'tmdb_id=' + encodeURIComponent(ids.tmdb),
            'imdb_id=' + encodeURIComponent(ids.imdb),
            'kp_id=' + encodeURIComponent(ids.kp)
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
                            subtitles: item.subtitles || null,
                            headers: item.headers || null
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
        setting: 'sergey_unified_archive',
        default_enabled: true,
        description: 'Открытые и обще-доступные видео из Internet Archive',
        search: archiveSearch
    });

    registerProvider({
        id: 'json',
        name: 'Open JSON API',
        setting: 'sergey_unified_json',
        default_enabled: false,
        description: 'Ваш разрешённый JSON API с прямыми ссылками на видео',
        search: genericJsonSearch
    });

    function enabledProviders() {
        return providers.filter(function (provider) {
            return isEnabled(provider.setting, provider.default_enabled !== false);
        });
    }

    function playItem(item, movie) {
        if (!item || !item.url) return;
        try { Lampa.Select.close(); } catch (e) {}

        try {
            Lampa.Player.play({
                url: item.url,
                title: movieTitle(movie),
                quality: 'auto',
                headers: item.headers || undefined,
                subtitles: item.subtitles || undefined
            });
        } catch (e) {
            notify('Не удалось открыть поток: ' + (e.message || e));
        }
    }

    function showResults(items, movie, failed) {
        items = dedupe(items);
        items.sort(function (a, b) {
            var qa = qualityScore(a.quality);
            var qb = qualityScore(b.quality);
            if (qa !== qb) return qb - qa;
            return String(a.provider).localeCompare(String(b.provider));
        });

        if (!items.length) {
            notify('Sergey Online: ничего не найдено' + (failed ? ' (часть источников не ответила)' : ''));
            return;
        }

        var menu = items.map(function (item) {
            var parts = [item.provider];
            if (item.quality) parts.push(item.quality);
            if (item.voice) parts.push(item.voice);
            if (item.season) parts.push('S' + item.season);
            if (item.episode) parts.push('E' + item.episode);
            return {
                title: item.title || movieTitle(movie),
                subtitle: parts.join(' • ') + (item.subtitle ? ' • ' + item.subtitle : ''),
                __sergey_item: item
            };
        });

        Lampa.Select.show({
            title: 'Sergey Online — ' + movieTitle(movie),
            items: menu,
            onSelect: function (row) {
                playItem(row.__sergey_item, movie);
            },
            onBack: function () {
                try { Lampa.Controller.toggle('content'); } catch (e) {}
            }
        });
    }

    function searchAll(movie) {
        var active = enabledProviders();
        if (!active.length) {
            notify('Sergey Online: включите хотя бы один источник в настройках');
            return;
        }

        notify('Sergey Online: ищу в ' + active.length + ' источниках…');

        var tasks = active.map(function (provider) {
            return withTimeout(provider.search(movie), 20000, provider.name).then(function (result) {
                result.items = result.items.map(function (item) { return normalizeItem(item, provider); });
                return result;
            });
        });

        Promise.all(tasks).then(function (results) {
            var all = [];
            var failed = 0;
            results.forEach(function (result) {
                if (!result.ok) failed++;
                all = all.concat(result.items || []);
            });
            showResults(all, movie, failed);
        });
    }

    function addButtonToFull(e) {
        try {
            var root = e.object.activity.render();
            var container = root.find('.full-start-new__buttons');
            if (!container.length) container = root.find('.full-start__buttons');
            if (!container.length) return;
            if (root.find('.view--sergey-unified').length) return;

            var movie = e.data && e.data.movie ? e.data.movie : (e.object.card || {});
            var btn = $('<div class="full-start__button selector view--online view--sergey-unified">' +
                '<svg class="button__icon" width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">' +
                '<circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2"/>' +
                '<path d="M10 8l6 4-6 4V8z" fill="currentColor"/></svg>' +
                '<span>SERGEY ONLINE</span></div>');

            btn.on('hover:enter', function () { searchAll(movie); });
            container.prepend(btn);
        } catch (err) {
            log('button error', err);
        }
    }

    function addSettings() {
        if (!Lampa.SettingsApi) return;

        try {
            Lampa.SettingsApi.addComponent({
                component: ID,
                name: NAME,
                icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2"/><path d="M10 8l6 4-6 4V8z" fill="currentColor"/></svg>'
            });
        } catch (e) {}

        try {
            Lampa.SettingsApi.addParam({
                component: ID,
                param: { name: 'sergey_unified_archive', type: 'trigger', default: true },
                field: {
                    name: 'Internet Archive',
                    description: 'Открытые/обще-доступные видео. Полезно как рабочий тест единого поиска.'
                }
            });
        } catch (e) {}

        try {
            Lampa.SettingsApi.addParam({
                component: ID,
                param: { name: 'sergey_unified_json', type: 'trigger', default: false },
                field: {
                    name: 'Open JSON API',
                    description: 'Подключить разрешённый API, возвращающий прямые ссылки на видео'
                }
            });
        } catch (e) {}

        try {
            Lampa.SettingsApi.addParam({
                component: ID,
                param: {
                    name: 'sergey_unified_json_url',
                    type: 'input',
                    values: '',
                    placeholder: 'https://example.org/api/search',
                    default: ''
                },
                field: {
                    name: 'URL Open JSON API',
                    description: 'GET: title, original_title, year, tmdb_id, imdb_id, kp_id; ответ: results[] с url/file'
                }
            });
        } catch (e) {}

        try {
            Lampa.SettingsApi.addParam({
                component: ID,
                param: { name: 'sergey_unified_version', type: 'static', default: VERSION },
                field: { name: 'Версия', description: VERSION }
            });
        } catch (e) {}
    }

    function installStyles() {
        if (document.getElementById('sergey-unified-style')) return;
        var style = document.createElement('style');
        style.id = 'sergey-unified-style';
        style.innerHTML = '.view--sergey-unified{font-weight:700}.view--sergey-unified .button__icon{margin-right:.4em}';
        document.head.appendChild(style);
    }

    function start() {
        if (started) return;
        if (!window.Lampa || !window.$) {
            setTimeout(start, 300);
            return;
        }
        started = true;
        window.__SERGEY_UNIFIED_ONLINE__ = VERSION;

        addSettings();
        installStyles();

        Lampa.Listener.follow('full', function (e) {
            if (e.type === 'complite') addButtonToFull(e);
        });

        try {
            var active = Lampa.Activity.active();
            if (active && active.component === 'full' && active.activity) {
                addButtonToFull({ object: active, data: { movie: active.card || active.movie || {} } });
            }
        } catch (e) {}

        window.SergeyOnline = {
            version: VERSION,
            providers: function () { return providers.slice(); },
            registerProvider: registerProvider,
            search: searchAll
        };

        log(NAME + ' v' + VERSION + ' started; providers:', providers.map(function (p) { return p.id; }));
    }

    if (window.appready) start();
    else if (window.Lampa && Lampa.Listener) {
        Lampa.Listener.follow('app', function (e) {
            if (e.type === 'ready') start();
        });
        setTimeout(start, 1500);
    } else {
        setTimeout(start, 500);
    }
})();