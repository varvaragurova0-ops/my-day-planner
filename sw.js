/* ============================================================
   Service Worker для My Day — Планер
   Стратегии:
   - Навигация (HTML): network-first → fallback на кэш
   - Остальное: cache-first → network → fallback
   ============================================================ */

const CACHE_VERSION = 'v2';
const CACHE_NAME = `my-day-planner-${CACHE_VERSION}`;

// Файлы, которые кэшируем при установке
const PRECACHE_URLS = [
  './',
  './site.html',
  './manifest.json',
  './app.js',
  './icons/icon-192x192.png',
  './icons/icon-512x512.png',
  // Шрифт лучше скачать локально в fonts/ и раскомментировать:
  // './fonts/ADLaMDisplay-Regular.woff2',
];

// ---------- INSTALL ----------
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Кэширую файлы приложения');
        return cache.addAll(PRECACHE_URLS);
      })
      .then(() => self.skipWaiting())
  );
});

// ---------- ACTIVATE ----------
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[SW] Удаляю старый кэш:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// ---------- FETCH ----------
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Не обрабатываем не-GET запросы
  if (request.method !== 'GET') return;

  // Пропускаем запросы к другим origin (например, Google Fonts) —
  // их обрабатывает сам браузер
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    // Можно добавить кэш для шрифтов Google:
    if (url.hostname.includes('fonts.googleapis.com') ||
        url.hostname.includes('fonts.gstatic.com')) {
      event.respondWith(
        caches.match(request).then((cached) => {
          if (cached) return cached;
          return fetch(request).then((response) => {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
            return response;
          }).catch(() => cached);
        })
      );
    }
    return;
  }

  // Навигация (открытие страницы) — network-first с фолбэком на site.html
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(() => caches.match('./site.html'))
    );
    return;
  }

  // Остальные ресурсы — cache-first
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;

      return fetch(request)
        .then((response) => {
          // Кэшируем только успешные ответы
          if (!response || response.status !== 200 || response.type === 'opaque') {
            return response;
          }
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(() => {
          // Если ничего не помогло и это HTML — отдаём главную
          if (request.headers.get('accept')?.includes('text/html')) {
            return caches.match('./site.html');
          }
        });
    })
  );
});

// ---------- MESSAGE (для ручного обновления) ----------
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});