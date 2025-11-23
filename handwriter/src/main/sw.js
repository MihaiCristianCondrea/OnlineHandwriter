const CACHE_NAME = 'handwriter-shell-v1';
const ASSETS = [
  './index.html',
  './manifest.json',
  './sw.js',
  '../styles/style.css',
  '../main/app.js',
  '../main/camera.js',
  '../main/config.js',
  '../main/knn.js',
  '../main/preprocess.js',
  '../main/storage.js',
  '../main/ui.js',
  './icons/icon-192.png',
  './icons/icon-512.png'
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
