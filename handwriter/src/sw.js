const CACHE_NAME = 'handwriter-shell-v2';
const ASSETS = [
  './index.html',
  './manifest.json',
  './sw.js',
  './main/styles/style.css',
  './main/app/app.js',
  './main/domain/config.js',
  './main/domain/knn.js',
  './main/domain/preprocess.js',
  './main/services/camera.js',
  './main/services/storage.js',
  './main/features/ui.js',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if(event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then(resp => resp || fetch(event.request).catch(() => resp))
  );
});
