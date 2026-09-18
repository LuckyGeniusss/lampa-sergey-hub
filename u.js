(function () {
    'use strict';

    if (window.sergey_online_ready) return;
    window.sergey_online_ready = true;

    var NAME = 'Sergey Online';
    var VERSION = '0.4.0';
    var COMPONENT = 'sergey_online_component';
    var SETTINGS = 'sergey_online_settings';
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

    function enabledProviders() {
        return providers.filter(providerEnabled);
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
                    }).catch(function () {
                        return [];
                    });
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

    function openFallback(movie) {
        var active = enabledProviders();

        if (!active.length) {
            notify('Sergey Online: включите хотя бы один источник в настройках');
            return;
        }

        Lampa.Select.show({
            title: 'Источник',
            items: [{ title: 'Все источники', source: 'all', selected: true }].concat(active.map(function (provider) {
                return {
                    title: provider.name,
                    source: provider.id
                };
            })),
            onSelect: function (source) {
                var selected = source.source === 'all'
                    ? active
                    : active.filter(function (provider) { return provider.id === source.source; });

                notify('Sergey Online: поиск…');

                Promise.all(selected.map(function (provider) {
                    return runProvider(provider, movie);
                })).then(function (results) {
                    var all = [];
                    results.forEach(function (result) {
                        all = all.concat(result.items || []);
                    });

                    all = dedupe(all);

                    if (!all.length) {
                        notify('Sergey Online: ничего не найдено');
                        return;
                    }

                    Lampa.Select.show({
                        title: NAME + ' — ' + movieTitle(movie),
                        items: all.map(function (item) {
                            return {
                                title: item.title || movieTitle(movie),
                                subtitle: [item.provider, item.quality, item.voice].filter(Boolean).join(' • '),
                                sergey_item: item
                            };
                        }),
                        onSelect: function (item) {
                            play(item.sergey_item, movie);
                        },
                        onBack: function () {
                            try { Lampa.Controller.toggle('content'); } catch (e) {}
                        }
                    });
                });
            },
            onBack: function () {
                try { Lampa.Controller.toggle('content'); } catch (e) {}
            }
        });
    }

    function SergeyOnlineComponent(object) {
        var scroll = new Lampa.Scroll({ mask: true, over: true });
        var files = new Lampa.Explorer(object);
        var filter = new Lampa.Filter(object);
        var self = this;
        var last = false;
        var destroyed = false;
        var allResults = [];
        var filterState = { season: '', voice: '' };
        var activeSource = String(storage('sergey_online_last_source', 'all') || 'all');

        function sourceProviders() {
            var active = enabledProviders();

            if (activeSource !== 'all' && !active.some(function (provider) { return provider.id === activeSource; })) {
                activeSource = 'all';
            }

            return active;
        }

        function sourceTitle() {
            if (activeSource === 'all') return 'Все источники';
            var provider = providers.filter(function (item) { return item.id === activeSource; })[0];
            return provider ? provider.name : 'Все источники';
        }

        function setupSourceFilter() {
            var active = sourceProviders();
            var items = [];

            if (active.length > 1) {
                items.push({
                    title: 'Все источники',
                    source: 'all',
                    selected: activeSource === 'all'
                });
            }

            active.forEach(function (provider) {
                items.push({
                    title: provider.name,
                    source: provider.id,
                    selected: activeSource === provider.id
                });
            });

            filter.set('sort', items);
            filter.chosen('sort', [sourceTitle()]);

            try {
                filter.render().find('.filter--sort span').text('Источник');
            } catch (e) {}
        }

        function currentResults() {
            return allResults.filter(function (item) {
                if (filterState.season && String(item.season || '') !== String(filterState.season)) return false;
                if (filterState.voice && String(item.voice || '') !== String(filterState.voice)) return false;
                return true;
            });
        }

        function setupContentFilter() {
            var seasons = {};
            var voices = {};

            allResults.forEach(function (item) {
                if (item.season !== undefined && item.season !== null && String(item.season) !== '') {
                    seasons[String(item.season)] = true;
                }
                if (item.voice) voices[String(item.voice)] = true;
            });

            var groups = [{
                title: 'Сбросить фильтр',
                reset: true
            }];

            var seasonKeys = Object.keys(seasons).sort(function (a, b) {
                return parseInt(a, 10) - parseInt(b, 10);
            });

            if (seasonKeys.length) {
                groups.push({
                    title: 'Сезон',
                    stype: 'season',
                    items: [{ title: 'Все сезоны', value: '', selected: !filterState.season }].concat(
                        seasonKeys.map(function (season) {
                            return {
                                title: 'Сезон ' + season,
                                value: season,
                                selected: String(filterState.season) === season
                            };
                        })
                    )
                });
            }

            var voiceKeys = Object.keys(voices).sort();

            if (voiceKeys.length) {
                groups.push({
                    title: 'Озвучка',
                    stype: 'voice',
                    items: [{ title: 'Все озвучки', value: '', selected: !filterState.voice }].concat(
                        voiceKeys.map(function (voice) {
                            return {
                                title: voice,
                                value: voice,
                                selected: String(filterState.voice) === voice
                            };
                        })
                    )
                });
            }

            if (groups.length > 1) {
                filter.set('filter', groups);

                var chosen = [];
                if (filterState.season) chosen.push('Сезон ' + filterState.season);
                if (filterState.voice) chosen.push(filterState.voice);
                filter.chosen('filter', chosen);

                try {
                    filter.render().find('.filter--filter span').text('Фильтр');
                } catch (e) {}
            } else {
                filter.set('filter', []);
            }
        }

        function itemHtml(item) {
            var meta = [item.provider];
            if (item.quality) meta.push(item.quality);
            if (item.voice) meta.push(item.voice);
            if (item.season) meta.push('Сезон ' + item.season);
            if (item.episode) meta.push('Серия ' + item.episode);

            return '<div class="sergey-online-item selector">' +
                '<div class="sergey-online-item__icon">' +
                    '<svg width="38" height="38" viewBox="0 0 38 38" fill="none" xmlns="http://www.w3.org/2000/svg">' +
                        '<circle cx="19" cy="19" r="16" stroke="currentColor" stroke-width="2"/>' +
                        '<path d="M16 12.5L27 19L16 25.5V12.5Z" fill="currentColor"/>' +
                    '</svg>' +
                '</div>' +
                '<div class="sergey-online-item__body">' +
                    '<div class="sergey-online-item__title"></div>' +
                    '<div class="sergey-online-item__meta"></div>' +
                    '<div class="sergey-online-item__subtitle"></div>' +
                '</div>' +
            '</div>';
        }

        function appendMessage(title, text) {
            var box = $('<div class="sergey-online-empty">' +
                '<div class="sergey-online-empty__title"></div>' +
                '<div class="sergey-online-empty__text"></div>' +
            '</div>');

            box.find('.sergey-online-empty__title').text(title);
            box.find('.sergey-online-empty__text').text(text);
            scroll.append(box);
        }

        function renderResults() {
            if (destroyed) return;

            scroll.clear();

            var list = currentResults();

            if (!list.length) {
                appendMessage(
                    'Здесь пусто',
                    'По выбранному источнику ничего не найдено. Выберите другой «Источник» сверху или уточните название через поиск.'
                );
            } else {
                list.forEach(function (item) {
                    var row = $(itemHtml(item));

                    row.find('.sergey-online-item__title').text(item.title || movieTitle(object.movie));
                    row.find('.sergey-online-item__meta').text(
                        [item.provider, item.quality, item.voice].filter(Boolean).join(' • ')
                    );
                    row.find('.sergey-online-item__subtitle').text(item.subtitle || '');

                    row.on('hover:focus', function () {
                        last = row[0];
                    });

                    row.on('hover:enter', function () {
                        play(item, object.movie);
                    });

                    scroll.append(row);
                });
            }

            try {
                if (Lampa.Activity.active().activity === self.activity) self.start();
            } catch (e) {}
        }

        function renderLoading() {
            scroll.clear();
            appendMessage('Ищем…', 'Проверяем выбранные источники для «' + movieTitle(object.movie) + '».');
        }

        function search() {
            var active = sourceProviders();

            if (!active.length) {
                allResults = [];
                renderResults();
                notify('Sergey Online: включите хотя бы один источник в настройках');
                return;
            }

            var selected = activeSource === 'all'
                ? active
                : active.filter(function (provider) { return provider.id === activeSource; });

            if (!selected.length) selected = active;

            renderLoading();

            Promise.all(selected.map(function (provider) {
                return runProvider(provider, object.movie);
            })).then(function (results) {
                if (destroyed) return;

                var merged = [];
                results.forEach(function (result) {
                    merged = merged.concat(result.items || []);
                });

                allResults = dedupe(merged);
                allResults.sort(function (a, b) {
                    var qa = qualityScore(a.quality);
                    var qb = qualityScore(b.quality);
                    if (qa !== qb) return qb - qa;
                    return String(a.provider).localeCompare(String(b.provider));
                });

                setupContentFilter();
                renderResults();
            }).catch(function (error) {
                if (destroyed) return;
                log('component search error', error);
                allResults = [];
                renderResults();
            });
        }

        filter.onBack = function () {
            self.start();
        };

        filter.onSearch = function (value) {
            object.search = value;

            if (object.movie) {
                if (object.movie.title) object.movie.title = value;
                else if (object.movie.name) object.movie.name = value;
            }

            search();
        };

        filter.onSelect = function (type, a, b) {
            if (type === 'sort') {
                activeSource = a && a.source ? a.source : 'all';
                Lampa.Storage.set('sergey_online_last_source', activeSource);
                filter.chosen('sort', [sourceTitle()]);
                setTimeout(Lampa.Select.close, 10);
                filterState = { season: '', voice: '' };
                search();
                return;
            }

            if (type === 'filter') {
                if (a && a.reset) {
                    filterState = { season: '', voice: '' };
                    setupContentFilter();
                    setTimeout(Lampa.Select.close, 10);
                    renderResults();
                    return;
                }

                if (a && a.stype && b) {
                    filterState[a.stype] = b.value || '';
                    setupContentFilter();
                    renderResults();
                }
            }
        };

        this.create = function () {
            setupSourceFilter();

            try {
                if (filter.addButtonBack) filter.addButtonBack();
            } catch (e) {}

            try {
                scroll.body().addClass('sergey-online-list');
            } catch (e) {}

            files.appendFiles(scroll.render());
            files.appendHead(filter.render());

            try {
                scroll.minus(files.render().find('.explorer__files-head'));
            } catch (e) {}

            search();

            return this.render();
        };

        this.start = function () {
            if (destroyed) return;

            try {
                if (Lampa.Background && Lampa.Background.immediately && Lampa.Utils.cardImgBackgroundBlur) {
                    Lampa.Background.immediately(Lampa.Utils.cardImgBackgroundBlur(object.movie));
                }
            } catch (e) {}

            Lampa.Controller.add('content', {
                toggle: function () {
                    Lampa.Controller.collectionSet(files.render());
                    Lampa.Controller.collectionFocus(last || false, files.render());
                },
                up: function () {
                    if (typeof Navigator !== 'undefined' && Navigator.canmove('up')) Navigator.move('up');
                    else Lampa.Controller.toggle('head');
                },
                down: function () {
                    if (typeof Navigator !== 'undefined' && Navigator.canmove('down')) Navigator.move('down');
                },
                left: function () {
                    if (typeof Navigator !== 'undefined' && Navigator.canmove('left')) Navigator.move('left');
                    else Lampa.Controller.toggle('menu');
                },
                right: function () {
                    if (typeof Navigator !== 'undefined' && Navigator.canmove('right')) Navigator.move('right');
                },
                back: self.back.bind(self)
            });

            Lampa.Controller.toggle('content');
        };

        this.back = function () {
            Lampa.Activity.backward();
        };

        this.pause = function () {};
        this.stop = function () {};

        this.destroy = function () {
            destroyed = true;
            try { filter.destroy(); } catch (e) {}
            try { scroll.destroy(); } catch (e) {}
            try { files.destroy(); } catch (e) {}
        };

        this.render = function () {
            return files.render();
        };
    }

    function openScreen(movie) {
        movie = movie || {};

        if (!window.Lampa || !Lampa.Component || !Lampa.Activity || !Lampa.Explorer || !Lampa.Filter) {
            openFallback(movie);
            return;
        }

        Lampa.Activity.push({
            url: '',
            title: NAME,
            component: COMPONENT,
            search: movieTitle(movie),
            search_one: movieTitle(movie),
            search_two: originalTitle(movie),
            movie: movie,
            page: 1
        });
    }

    function buttonHtml() {
        return '<div class="full-start__button selector ' + BUTTON_CLASS + '" data-subtitle="Единый выбор источника • ' + VERSION + '">' +
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
                openScreen(e.data.movie);
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
                component: SETTINGS,
                name: NAME,
                icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2"/><path d="M10 8L17 12L10 16V8Z" fill="currentColor"/></svg>'
            });
        } catch (e) {}

        try {
            Lampa.SettingsApi.addParam({
                component: SETTINGS,
                param: { name: 'sergey_online_archive', type: 'trigger', default: true },
                field: {
                    name: 'Internet Archive',
                    description: 'Открытый источник. Используется также для проверки работы интерфейса и единого поиска.'
                }
            });
        } catch (e) {}

        try {
            Lampa.SettingsApi.addParam({
                component: SETTINGS,
                param: { name: 'sergey_online_json', type: 'trigger', default: false },
                field: {
                    name: 'Open JSON API',
                    description: 'Разрешённый внешний API с прямыми ссылками на видео.'
                }
            });
        } catch (e) {}

        try {
            Lampa.SettingsApi.addParam({
                component: SETTINGS,
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
                component: SETTINGS,
                param: { name: 'sergey_online_version', type: 'static', default: VERSION },
                field: { name: 'Версия', description: VERSION }
            });
        } catch (e) {}
    }

    function installStyles() {
        if (document.getElementById('sergey-online-v4-style')) return;

        var style = document.createElement('style');
        style.id = 'sergey-online-v4-style';
        style.innerHTML =
            '.sergey-online-list{padding-top:.5em}' +
            '.sergey-online-item{display:flex;align-items:center;padding:1em 1.15em;margin-bottom:.7em;border-radius:.55em;background:rgba(255,255,255,.08);min-height:4.5em}' +
            '.sergey-online-item.focus{background:#fff;color:#111}' +
            '.sergey-online-item__icon{width:3.2em;min-width:3.2em;display:flex;align-items:center;justify-content:center;margin-right:1em}' +
            '.sergey-online-item__body{min-width:0;flex:1}' +
            '.sergey-online-item__title{font-size:1.18em;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
            '.sergey-online-item__meta{font-size:.9em;opacity:.8;margin-top:.28em}' +
            '.sergey-online-item__subtitle{font-size:.8em;opacity:.55;margin-top:.22em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
            '.sergey-online-empty{padding:2.6em 1em}' +
            '.sergey-online-empty__title{font-size:1.8em;font-weight:600;margin-bottom:.45em}' +
            '.sergey-online-empty__text{font-size:1.05em;opacity:.75;max-width:42em}';

        document.head.appendChild(style);
    }

    function init() {
        installStyles();
        addSettings();

        Lampa.Component.add(COMPONENT, SergeyOnlineComponent);

        Lampa.Manifest.plugins = {
            type: 'video',
            version: VERSION,
            name: NAME,
            description: 'Единый экран выбора онлайн-источника',
            component: COMPONENT,
            onContextMenu: function () {
                return {
                    name: NAME,
                    title: NAME,
                    description: 'Выбрать источник и смотреть'
                };
            },
            onContextLauch: function (movie) {
                openScreen(movie);
            }
        };

        Lampa.Listener.follow('full', installFullButton);

        window.SergeyOnline = {
            version: VERSION,
            open: openScreen,
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