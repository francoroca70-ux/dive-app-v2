// Seven Seas — service worker
// Scope: caches the app shell (index.html + icons + manifest) so the app can
// install and load offline. Deliberately does NOT touch Supabase/API requests
// or any other cross-origin request — those already have their own offline
// queue/retry logic built into index.html, and caching them here would risk
// serving stale data instead of letting that existing system do its job.
//
// Bump CACHE_VERSION whenever you want returning users to pick up a fresh
// app shell faster (old caches are cleaned up automatically on activate).
const CACHE_VERSION = 'seven-seas-v1';
const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.json',
  '/assets/icons/icon-72.png',
  '/assets/icons/icon-96.png',
  '/assets/icons/icon-128.png',
  '/assets/icons/icon-144.png',
  '/assets/icons/icon-152.png',
  '/assets/icons/icon-192.png',
  '/assets/icons/icon-384.png',
  '/assets/icons/icon-512.png',
  '/assets/icons/maskable-192.png',
  '/assets/icons/maskable-512.png',
  '/assets/icons/apple-touch-icon.png',
  '/assets/logo-icon.png',
  '/assets/logo-full.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(APP_SHELL)).catch(() => {
      // Don't let a single missing asset block install — cache what we can.
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Only handle same-origin GET requests. Everything else (Supabase, fonts,
  // CDN scripts, POST/PATCH/etc.) passes straight through to the network,
  // untouched, so existing app behavior (including the offline queue) is
  // unaffected.
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) {
    return;
  }

  const isNavigation = req.mode === 'navigate' || req.destination === 'document';

  if (isNavigation) {
    // Network-first for the app shell HTML: always try to get the latest
    // build when online, fall back to the cached shell when offline.
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put('/index.html', copy));
          return res;
        })
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  // Cache-first for static assets (icons, manifest) — rarely change.
  event.respondWith(
    caches.match(req).then((cached) => cached || fetch(req))
  );
});
