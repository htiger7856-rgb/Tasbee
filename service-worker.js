/* ==========================================================================
   Noor-e-Tasbeeh – service worker (offline cache)

   - Pre-caches every file the app needs, so it opens with no internet.
   - Cache-first for the app's own files.
   - To publish an update: change VERSION below. The new files are downloaded
     in the background and the app offers an "Update" button. User data lives
     in localStorage, which a service-worker update NEVER touches.
   ========================================================================== */
const VERSION = '1.0.0';
const CACHE_PREFIX = 'noor-cache-';
const CACHE = CACHE_PREFIX + VERSION;

// Relative URLs so the app works from any sub-folder (e.g. https://user.github.io/repo/).
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  './amiri-arabic-400-normal.woff2',
  './amiri-arabic-700-normal.woff2',
  './icon-192.png',
  './icon-512.png',
  './maskable-512.png',
  './apple-touch-icon.png',
  './favicon-32.png'
];

self.addEventListener('install', (event) => {
  // Not calling skipWaiting() here: an updated worker waits until the user taps "Update"
  // (or closes the app), so a running session is never swapped under their hands.
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS.map((u) => new Request(u, { cache: 'reload' }))))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k.startsWith(CACHE_PREFIX) && k !== CACHE).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;   // the app never needs other origins

  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      }).catch(() => {
        // Offline and not cached: for page loads fall back to the app shell.
        if (req.mode === 'navigate') return caches.match('./index.html');
        return new Response('', { status: 504, statusText: 'Offline' });
      });
    })
  );
});
