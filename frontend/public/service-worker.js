// IMORA PWA Service Worker — v3 (network-first for hashed assets, SPA-safe)
const CACHE = 'imora-v3';

self.addEventListener('install', (e) => {
  // Pre-cache only the shell entry
  e.waitUntil(caches.open(CACHE).then((c) => c.add('/')).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

const isHashedAsset = (url) =>
  url.pathname.startsWith('/static/') ||
  /\.(js|css|woff2?|ttf|otf|map)$/i.test(url.pathname);

const isImage = (url) => /\.(png|jpe?g|webp|gif|svg|ico)$/i.test(url.pathname);

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // 1) API: network-first, fallback to cache
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(req, clone)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  // 2) Navigation requests (HTML): network-first, fallback to cached '/'
  if (req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html')) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put('/', clone)).catch(() => {});
          return res;
        })
        .catch(() => caches.match('/'))
    );
    return;
  }

  // 3) Hashed JS/CSS assets: network-first, NEVER fallback to '/' (would return HTML)
  if (isHashedAsset(url)) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE).then((c) => c.put(req, clone)).catch(() => {});
          }
          return res;
        })
        .catch(() => caches.match(req)) // only the same exact URL, no HTML fallback
    );
    return;
  }

  // 4) Images & other static: cache-first
  if (isImage(url)) {
    event.respondWith(
      caches.match(req).then(
        (cached) =>
          cached ||
          fetch(req).then((res) => {
            if (res && res.status === 200) {
              const clone = res.clone();
              caches.open(CACHE).then((c) => c.put(req, clone)).catch(() => {});
            }
            return res;
          })
      )
    );
    return;
  }

  // 5) Default: network-first, no HTML fallback
  event.respondWith(fetch(req).catch(() => caches.match(req)));
});

// Allow clients to force activation
self.addEventListener('message', (e) => {
  if (e.data === 'skipWaiting') self.skipWaiting();
});
