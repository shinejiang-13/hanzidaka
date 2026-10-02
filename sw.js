// ???? Service Worker - ????
const CACHE_NAME = 'hanzidaka-v2';

// ????????
const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './css/style.css',
  './js/auth.js',
  './js/srs.js',
  './js/store.js',
  './js/reward.js',
  './js/handwriting.js',
  './js/app.js',
  './js/hanzi-data.js'
];

// ?? CDN ??(hanzi-writer ???)
const CDN_URLS = [
  'https://cdn.jsdelivr.net/npm/hanzi-writer@3.5/dist/hanzi-writer.min.js'
];

// ??:??????? + ???? CDN
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // ??????????
      await cache.addAll(PRECACHE_URLS);
      // CDN ??????(???????)
      try {
        await cache.addAll(CDN_URLS);
      } catch (e) {
        console.log('[SW] CDN cache skipped:', e);
      }
      console.log('[SW] Precached', PRECACHE_URLS.length, 'local files');
    })
  );
  self.skipWaiting();
});

// ??:?????
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      );
    })
  );
  self.clients.claim();
});

// ????
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // ??? GET ??
  if (request.method !== 'GET') return;

  // HTML ??:????(????????????)
  if (request.mode === 'navigate' || url.pathname.endsWith('.html') || url.pathname === '/') {
    event.respondWith(
      fetch(request).then((resp) => {
        if (resp && resp.status === 200) {
          const clone = resp.clone();
          caches.open(CACHE_NAME).then((c) => c.put(request, clone));
        }
        return resp;
      }).catch(() => caches.match(request))
    );
    return;
  }

  // ??????(CSS/JS/??):????,????
  if (url.origin === location.origin) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const networkFetch = fetch(request).then((resp) => {
          if (resp && resp.status === 200 && resp.type === 'basic') {
            const clone = resp.clone();
            caches.open(CACHE_NAME).then((c) => c.put(request, clone));
          }
          return resp;
        }).catch(() => cached);
        return cached || networkFetch;
      })
    );
    return;
  }

  // CDN ?????:????(?????)
  event.respondWith(
    caches.match(request).then((cached) => {
      return cached || fetch(request).then((resp) => {
        if (resp && (resp.status === 200 || resp.type === 'opaque')) {
          const clone = resp.clone();
          caches.open(CACHE_NAME).then((c) => c.put(request, clone));
        }
        return resp;
      }).catch(() => cached);
    })
  );
});
