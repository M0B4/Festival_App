const CACHE_NAME = 'metal-fest-guide-v3.2';
const STATIC_ASSETS = [
    'index.html',
    'style.css',
    'app.js',
    'festivals.js',
    'countries.js',
    'manifest.json'
];

// 1. Installation: Statische Dateien sichern
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            console.log('Static Assets werden gecached...');
            return cache.addAll(STATIC_ASSETS);
        })
    );
    self.skipWaiting();
});

// 2. Aktivierung: Alten Cache aufräumen
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(
                keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
            );
        })
    );
});

// 3. Fetch-Strategie: Cache first, then Network + Runtime Caching
self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request).then(cachedResponse => {
            if (cachedResponse) {
                return cachedResponse;
            }

            return fetch(event.request).then(networkResponse => {
                // Nur JSON-Dateien aus dem festivaldata-Ordner im Runtime-Cache speichern
                if (event.request.url.includes('/festivaldata/') && networkResponse.status === 200) {
                    const responseToCache = networkResponse.clone();
                    caches.open(CACHE_NAME).then(cache => {
                        cache.put(event.request, responseToCache);
                    });
                }
                return networkResponse;
            });
        }).catch(() => {
            // Optional: Hier könnte eine "Offline-Meldung" erscheinen
        })
    );
});