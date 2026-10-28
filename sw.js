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
const CACHE_VERSION = 'seven-seas-v110';
const APP_SHELL = [
  '/',
  '/index.html',
  // 14/10/2026: la landing faltaba acá, y la raíz del dominio público redirige
  // a ella. Sin red, ese pedido no se podía contestar ni desde la red ni desde
  // la caché. El arreglo que importa está en `index.html` —sin red no se
  // redirige— pero cachearla igual es correcto: es una página del shell, pesa
  // poco, y un prospecto con señal mala merece verla.
  '/landing.html',
  '/manifest.json',
  // 27/10/2026: la librería de Supabase. Antes venía de un CDN, y el `fetch`
  // de abajo ignora a propósito todo lo que no sea del mismo origen — así que
  // la dependencia más crítica de la app era la única que el service worker
  // no podía guardar. Ahora es un archivo nuestro y entra al shell como
  // cualquier otro.
  '/assets/vendor/supabase-js-2.118.0.js',
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

// 26/10/2026: ESTO ERA `cache.addAll(APP_SHELL)` CON UN `catch` VACÍO, y el
// comentario decía «no dejes que un asset faltante bloquee el install — cacheá
// lo que se pueda». Hacía exactamente lo contrario.
//
// `addAll` es ATÓMICO: si una sola de las 19 URLs falla, la promesa se rechaza y
// **no se guarda ninguna**. El `catch` vacío se tragaba el rechazo, así que el
// install terminaba «bien» con la caché VACÍA y sin una línea en la consola.
// Y el `activate` ya había borrado la caché de la versión anterior.
//
// Resultado: un centro que hubiera pescado un solo fetch lento —Render
// despertando de dormir, un semáforo de wifi en el muelle— se quedaba **sin
// nada offline** hasta el deploy siguiente, y la app se lo escondía.
//
// Peor en la app instalada: `/landing.html` está en APP_SHELL y `build-www.js`
// no lo copiaba al paquete, así que ahí el install fallaba SIEMPRE.
//
// Ahora se cachea una por una. Una URL rota se queda afuera y se registra; las
// otras 18 entran, que es lo que el comentario viejo prometía.
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then(async (cache) => {
      const fallaron = [];
      await Promise.all(APP_SHELL.map(async (url) => {
        try {
          const res = await fetch(url, { cache: 'reload' });
          // Una respuesta de error es una falla: guardar un 404 en la caché es
          // peor que no guardar nada, porque offline se sirve el 404 como si
          // fuera el archivo.
          if (!res || !res.ok) throw new Error('HTTP ' + (res && res.status));
          await cache.put(url, res);
        } catch (e) {
          fallaron.push(url + ' (' + (e && e.message) + ')');
        }
      }));
      if (fallaron.length) {
        // Se dice en voz alta. El modo de falla anterior era el silencio.
        console.warn('[sw] no se pudieron cachear ' + fallaron.length + ' de ' +
                     APP_SHELL.length + ': ' + fallaron.join(', '));
      }
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
  //
  // Y lo que se trae por red SE GUARDA. Antes era `cached || fetch(req)`, que
  // devuelve la respuesta y la tira: un ícono que no hubiera entrado en el
  // install no entraba NUNCA, por mucho que la persona abriera la app con
  // señal. La caché no tenía forma de recuperarse sola, y por eso un solo
  // tropiezo en el install se volvía permanente hasta el deploy siguiente.
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        if (res && res.ok) {
          const copia = res.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(req, copia));
        }
        return res;
      });
    })
  );
});
