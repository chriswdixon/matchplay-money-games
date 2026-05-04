// Kill-switch service worker.
// Tyche no longer supports PWA. This worker exists only to remove any
// previously-installed service worker + caches from devices that registered
// an older PWA build, then unregister itself.
self.addEventListener("install", (e) => e.waitUntil(self.skipWaiting()));
self.addEventListener("activate", (e) =>
  e.waitUntil(
    (async () => {
      try {
        await self.clients.claim();
        const names = await caches.keys();
        await Promise.all(names.map((n) => caches.delete(n)));
        const clients = await self.clients.matchAll({
          type: "window",
          includeUncontrolled: true,
        });
        await Promise.all(
          clients.map((c) => {
            try {
              const url = new URL(c.url);
              url.searchParams.set("sw-cleanup", Date.now().toString());
              return c.navigate(url.toString());
            } catch (_) {
              return undefined;
            }
          }),
        );
        await self.registration.unregister();
      } catch (_) {
        // best-effort cleanup; ignore failures
      }
    })(),
  ),
);
// Pass-through fetch so we never serve a cached shell.
self.addEventListener("fetch", () => {});
