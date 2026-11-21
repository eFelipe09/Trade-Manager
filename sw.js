/* Trade Manager — offline cache. Bump CACHE on every deploy. */
const CACHE = 'tm-v42';
const ASSETS = [
  './', './index.html', './manifest.webmanifest',
  './icon-192.png', './icon-512.png', './icon-512-maskable.png', './apple-touch-icon.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Network-first for the page (so updates arrive), cache-first for everything else.
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) {
    // the Firebase SDK is versioned and immutable, so cache it: the app then
    // opens and signs in from cache when the connection is poor or absent.
    const cacheable =
      (url.hostname === 'www.gstatic.com' && url.pathname.indexOf('/firebasejs/') === 0) ||
      url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
    if (cacheable) {
      e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
        if (res && res.ok) { const cp = res.clone(); caches.open(CACHE).then(c => c.put(req, cp)); }
        return res;
      })));   // nothing cached and no network: let it fail, the app copes
    }
    return;
  }
  const isPage = req.mode === 'navigate' || req.destination === 'document';
  if (isPage) {
    e.respondWith(
      fetch(req)
        .then(res => { const cp = res.clone(); caches.open(CACHE).then(c => c.put(req, cp)); return res; })
        .catch(() => caches.match(req).then(r => r || caches.match('./index.html')))
    );
  } else {
    e.respondWith(
      caches.match(req).then(hit => hit || fetch(req).then(res => {
        const cp = res.clone(); caches.open(CACHE).then(c => c.put(req, cp)); return res;
      }).catch(() => hit))
    );
  }
});
