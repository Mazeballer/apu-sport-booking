self.addEventListener('install', (event) => {
  console.log('Service Worker installing');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('Service Worker activating');
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Keeps it installable and online-only for now
  event.respondWith(fetch(event.request));
});
