// Simple service worker for offline use
const CACHE = 'papercut-cache-v1';
const ASSETS = ['/', './index.html', './styles.css', './app.js', './vendor/gifenc.min.js', './manifest.webmanifest'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (e) => {
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
});
