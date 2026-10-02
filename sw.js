// 汉字打卡 Service Worker - 离线缓存
const CACHE_NAME = 'hanzidaka-v2';

// 预缓存的本地资源
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

// 外部 CDN 资源（hanzi-writer 笔顺库）
const CDN_URLS = [
  'https://cdn.jsdelivr.net/npm/hanzi-writer@3.5/dist/hanzi-writer.min.js'
];

// 安装：预缓存本地资源 + 尝试缓存 CDN
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // 本地资源必须缓存成功
      await cache.addAll(PRECACHE_URLS);
      // CDN 资源尽量缓存（失败不影响安装）
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

// 激活：清理旧缓存
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

// 请求拦截
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 只处理 GET 请求
  if (request.method !== 'GET') return;

  // HTML 文档：网络优先（确保用户总是拿到最新页面）
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

  // 本地静态资源（CSS/JS/图片）：缓存优先，后台更新
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

  // CDN 等跨域资源：缓存优先（不透明响应）
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
