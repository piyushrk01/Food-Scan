// sw.js — LiquidDiet Service Worker

const CACHE = 'liquiddiet-v2';

const ASSETS = [
    './fs.html',
    './style.css',
    './app.js',
    './auth.js',
    './dashboard.js',
    './scanner.js',
    './firebase-config.js',
    './manifest.json',
    'https://cdn.tailwindcss.com',
    'https://unpkg.com/html5-qrcode',
    'https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap'
];

// Install — pre-cache
self.addEventListener('install', event => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE)
            .then(cache => cache.addAll(ASSETS))
            .catch(err  => console.warn('Cache partial fail:', err))
    );
});

// Activate — clear old caches
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys()
            .then(keys => Promise.all(
                keys.filter(k => k !== CACHE).map(k => caches.delete(k))
            ))
            .then(() => self.clients.claim())
    );
});

// Fetch — smart strategy
self.addEventListener('fetch', event => {
    const url = event.request.url;

    // Network-first for live API calls
    const isLive =
        url.includes('firestore.googleapis.com') ||
        url.includes('firebase')                 ||
        url.includes('openfoodfacts.org')        ||
        url.includes('identitytoolkit');

    if (isLive) {
        event.respondWith(
            fetch(event.request).catch(() => caches.match(event.request))
        );
        return;
    }

    // Cache-first for all static assets
    event.respondWith(
        caches.match(event.request).then(cached => {
            if (cached) return cached;

            return fetch(event.request).then(res => {
                if (res && res.status === 200 && event.request.method === 'GET') {
                    const clone = res.clone();
                    caches.open(CACHE).then(c => c.put(event.request, clone));
                }
                return res;
            }).catch(() => {
                // Offline fallback for document requests
                if (event.request.destination === 'document') {
                    return caches.match('./fs.html');
                }
            });
        })
    );
});