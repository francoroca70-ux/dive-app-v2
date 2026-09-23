// Seven Seas — service worker
// Scope: caches the app shell (index.html + icons + manifest) so the app can
// install and load offline. Deliberately does NOT touch Supabase/API requests
// or any other cross-origin request — those already have their own offline
// queue/retry logic built into index.html, and caching them here would risk
// serving stale data instead of letting that existing system do its job.
//
// Bump CACHE_VERSION whenever you want returning users to pick up a fresh
// app shell faster (old caches are cleaned up automatically on activate).
// Subir esta versión en cada deploy que cambie index.html. Al activarse, el
// service worker borra todas las cachés que no coincidan, así que una copia
// vieja no puede sobrevivir a un deploy.
//
// 23/09/2026: v2 -> v3. La v2 dejó a Fran dos días con una versión vieja de la
// app sin forma de enterarse: pedía index.html y el service worker se lo servía
// desde la caché. Arreglos desplegados que él nunca recibió.
const CACHE_VERSION = 'seven-seas-v3';
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
  '/assets/logo-full.png',
  '/assets/logo-wordmark-white.png',
  '/assets/logo-wordmark-navy.png'
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

  // El HTML NUNCA sale de la caché mientras haya red, sea navegación o no.
  //
  // Antes, un fetch('/index.html') (o cualquier pedido del HTML que no fuera
  // una navegación) caía en la rama de abajo, que es cache-first, y devolvía
  // la copia guardada. En la app nativa, que vive dentro de un webview, eso
  // puede dejar a un centro de buceo con una versión vieja durante días sin
  // ninguna señal de que algo está desactualizado.
  const url = new URL(req.url);
  if (url.pathname.endsWith('.html') || url.pathname === '/') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((c) => c || caches.match('/index.html')))
    );
    return;
  }

  // Cache-first sólo para estáticos de verdad (íconos, manifest), que cambian
  // de nombre cuando cambian de contenido.
  event.respondWith(
    caches.match(req).then((cached) => cached || fetch(req))
  );
});
