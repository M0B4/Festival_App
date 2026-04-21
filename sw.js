const CACHE_NAME = 'metal-fest-guide-v' + Date.now(); // Zeitstempel macht den Cache-Namen immer einzigartig

// 1. Installation: Dateien in den Cache laden
self.addEventListener('install', event => {
    self.skipWaiting(); // Zwingt den neuen SW, sofort aktiv zu werden
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            return cache.addAll([
                'index.html',
                'style.css',
                'app.js',
                'festivals.js',
                'countries.js',
                'manifest.json'
            ]);
        })
    );
});

// 2. Aktivierung: Alten Cache löschen
self.addEventListener('activate', event => {
    event.waitUntil(
        Promise.all([
            self.clients.claim(), // Übernimmt sofort die Kontrolle über alle offenen Tabs
            caches.keys().then(keys => {
                return Promise.all(
                    keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
                );
            })
        ])
    );
});

// 3. Fetch: Netzwerk-Anfragen bearbeiten
self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request).then(response => {
            return response || fetch(event.request);
        })
    );
});