/* ═══════════════════════════════════════════════════
   Ziphay — Service Worker (Security Hardened)
   Cache-first for static assets, network-first for HTML
   Enables offline use for core compression tools
   ⚠️ /dashboard EXCLUDED from cache (M6 fix)
═══════════════════════════════════════════════════ */

const CACHE_NAME = 'ziphay-v7';
const STATIC_ASSETS = [
    '/',
    '//',
    '//tools',
    '/style.css',
    '/script.js',
    '/animations.js',
    '/auth-ui.js',
    '/error-boundary.js',
    '/pages.css',
    '/favicon.png',
    '/manifest.json',
];

/* SECURITY: Pages that should NEVER be cached (contain authenticated content) */
const NO_CACHE_PAGES = [
    '//dashboard',
    '/dashboard',
];

const CDN_CACHE = 'ziphay-cdn-v2';
const CDN_URLS = [
    'https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=Inter:wght@300;400;500;600&family=Outfit:wght@300;400;500;600&display=swap',
];

/* ─── INSTALL ─── */
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            console.log('[Ziphay SW] Caching static assets');
            return cache.addAll(STATIC_ASSETS);
        })
    );
    self.skipWaiting();
});

/* ─── ACTIVATE ─── */
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(
                keys.filter(k => k !== CACHE_NAME && k !== CDN_CACHE)
                    .map(k => {
                        console.log('[Ziphay SW] Removing old cache:', k);
                        return caches.delete(k);
                    })
            )
        )
    );
    self.clients.claim();
});

/* ─── FETCH ─── */
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);

    // Skip non-GET requests
    if (event.request.method !== 'GET') return;

    // Skip Firebase/API requests
    if (url.hostname.includes('firebaseio.com') ||
        url.hostname.includes('googleapis.com') ||
        url.hostname.includes('identitytoolkit')) return;

    // SECURITY (M6): Never cache authenticated pages
    if (NO_CACHE_PAGES.some(page => url.pathname === page || url.pathname.endsWith(page))) {
        event.respondWith(
            fetch(event.request).catch(() => {
                return new Response(
                    '<html><body><h1>Offline</h1><p>Dashboard requires an internet connection.</p><a href="/">Go Home</a></body></html>',
                    { headers: { 'Content-Type': 'text/html' }, status: 503 }
                );
            })
        );
        return;
    }

    // CDN resources — cache-first
    if (url.hostname.includes('cdn.jsdelivr.net') ||
        url.hostname.includes('fonts.googleapis.com') ||
        url.hostname.includes('fonts.gstatic.com') ||
        url.hostname.includes('unpkg.com')) {
        event.respondWith(
            caches.open(CDN_CACHE).then(cache =>
                cache.match(event.request).then(cached => {
                    if (cached) return cached;
                    return fetch(event.request).then(response => {
                        /* SECURITY: Only cache successful, valid responses */
                        if (response.ok && response.status === 200) {
                            cache.put(event.request, response.clone());
                        }
                        return response;
                    });
                })
            )
        );
        return;
    }

    // HTML pages — network-first (so updates propagate)
    if (event.request.headers.get('Accept')?.includes('text/html')) {
        event.respondWith(
            fetch(event.request)
                .then(response => {
                    /* SECURITY: Only cache successful responses */
                    if (response.ok && response.status === 200) {
                        const clone = response.clone();
                        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                    }
                    return response;
                })
                .catch(() => caches.match(event.request) || caches.match('//'))
        );
        return;
    }

    // Static assets — cache-first
    event.respondWith(
        caches.match(event.request).then(cached => {
            if (cached) return cached;
            return fetch(event.request).then(response => {
                /* SECURITY: Only cache successful responses from same origin */
                if (response.ok && response.status === 200 && url.origin === location.origin) {
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, response.clone()));
                }
                return response;
            });
        }).catch(() => {
            // Offline fallback for images
            if (event.request.headers.get('Accept')?.includes('image')) {
                return new Response(
                    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><text x="12" y="12" text-anchor="middle" font-size="10">📷</text></svg>',
                    { headers: { 'Content-Type': 'image/svg+xml' } }
                );
            }
        })
    );
});

