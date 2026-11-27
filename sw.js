// Service worker: makes the app work with no signal.
// BUMP VERSION ON EVERY RELEASE, or phones keep the old copy.
const VERSION = 'v2';
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
  './js/ui.js',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)));
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
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then((hit) => hit || fetch(e.request))
  );
});
