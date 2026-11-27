// Service worker: makes the app work with no signal.
// BUMP VERSION ON EVERY RELEASE, or phones keep the old copy.
const VERSION = 'v7';
const CACHE = 'ibs-diary-' + VERSION;
const FILES = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/app.css',
  './js/app.js',
  './js/data.js',
  './js/db.js',
  './js/export.js',
  './js/foodform.js',
  './js/history.js',
  './js/library.js',
  './js/log.js',
  './js/picker.js',
  './js/seed.js',
  './js/sync.js',
  './js/ui.js',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

// cache: 'reload' goes to the network, skipping the browser's own HTTP cache.
// Without it, GitHub Pages' max-age=600 lets a new version be stored with
// files up to ten minutes old, and cache-first then serves them until the next
// release. That is how 1.2.0 reached a phone without the belching question.
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(FILES.map((f) => new Request(f, { cache: 'reload' }))))
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('ibs-diary-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// The page asks for this when you tap "update", never automatically.
self.addEventListener('message', (e) => {
  if (e.data === 'skipWaiting') self.skipWaiting();
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  if (new URL(e.request.url).origin !== location.origin) return; // e.g. NAS sync: always the network
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then((hit) => hit || fetch(e.request))
  );
});
