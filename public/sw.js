/* global self, clients */

self.addEventListener("install", (event) => {
  console.log("Service Worker installing");
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  console.log("Service Worker activating");
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  // Keeps it installable and online only for now
  event.respondWith(fetch(event.request));
});

// Handle incoming push notifications
self.addEventListener("push", (event) => {
  if (!event.data) return;

  let data;
  try {
    data = event.data.json();
  } catch (err) {
    console.error("Push event data was not JSON", err);
    return;
  }

  const title = data.title || "New notification";
  const body = data.body || "";
  const url = data.url || "/";
  const icon = data.icon || "/icon-192x192.png"; // change if your icon path is different
  const badge = data.badge || "/icon-192x192.png"; // optional

  const options = {
    body,
    icon,
    badge,
    data: { url },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Handle click on notification
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || "/";

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((list) => {
        for (const client of list) {
          if (client.url === targetUrl && "focus" in client) {
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow(targetUrl);
        }
      })
  );
});
