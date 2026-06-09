// Kill-switch service worker.
// Tyche no longer ships an offline app-shell service worker. This file exists
// only to evict any previously-installed Workbox / vite-plugin-pwa worker that
// returning browsers may still have registered at /sw.js. It deletes the
// stale app-shell caches, reloads open tabs onto fresh assets, then
// unregisters itself so nothing keeps serving outdated HTML.

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) =>
  event.waitUntil(
    (async () => {
      try {
        const cacheNames = await caches.keys();
        await Promise.allSettled(cacheNames.map((name) => caches.delete(name)));
        await self.clients.claim();
        const windowClients = await self.clients.matchAll({ type: "window" });
        await Promise.allSettled(
          windowClients.map((client) => {
            try {
              return client.navigate(client.url);
            } catch (_) {
              return undefined;
            }
          }),
        );
      } finally {
        await self.registration.unregister();
      }
    })(),
  ),
);

// Pass-through fetch so we never serve a cached shell.
self.addEventListener("fetch", () => {});
