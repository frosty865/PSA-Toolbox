/* Minimal service worker: cache app shell for offline use. No remote fetches. */
const CACHE_NAME = 'asset-dependency-tool-v2';

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.mode !== 'navigate' && !request.url.startsWith(self.location.origin)) return;
  if (request.method !== 'GET') return;

  const isNavigation = request.mode === 'navigate';

  if (isNavigation) {
    // Network-first for HTML: always try fresh, fall back to cache only when offline.
    // Prevents hard-reload requirement after each deploy.
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return res;
        })
        .catch(() => caches.open(CACHE_NAME).then((cache) => cache.match(request)))
    );
  } else {
    // Cache-first for static assets (JS, CSS, etc.) - they have content hashes.
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) =>
        cache.match(request).then((cached) =>
          cached ||
          fetch(request).then((res) => {
            const clone = res.clone();
            if (res.ok) cache.put(request, clone);
            return res;
          })
        )
      )
    );
  }
});
