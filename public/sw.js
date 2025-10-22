// Service Worker for PWA
self.addEventListener("install", (event) => {
  console.log("Service Worker installing.")
  self.skipWaiting()
})

self.addEventListener("activate", (event) => {
  console.log("Service Worker activating.")
})

self.addEventListener("fetch", (event) => {
  // Basic fetch handler - can be extended for offline support
  event.respondWith(fetch(event.request))
})
