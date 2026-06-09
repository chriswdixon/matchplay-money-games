/**
 * Service-worker cleanup.
 *
 * Tyche no longer ships an offline app-shell service worker. Any worker a
 * returning browser still has registered (from older PWA builds) is the most
 * common cause of stale/outdated pages: it keeps serving cached HTML and
 * chunks. This runs on every load, in every environment, to unregister those
 * workers and delete their caches.
 *
 * It does NOT force a reload loop — the kill-switch workers shipped at
 * /sw.js and /service-worker.js handle reloading returning clients exactly
 * once. This page-side pass is a belt-and-suspenders cleanup.
 */
export function cleanupServiceWorkers(): void {
  if (typeof window === "undefined") return;

  // Wipe any Cache Storage left behind by previous Workbox builds.
  if ("caches" in window) {
    void caches
      .keys()
      .then((names) => Promise.all(names.map((n) => caches.delete(n))))
      .catch(() => {});
  }

  const sw = navigator.serviceWorker;
  if (!sw || typeof sw.getRegistrations !== "function") return;

  void sw
    .getRegistrations()
    .then((regs) =>
      Promise.all(regs.map((r) => r.unregister().catch(() => false))),
    )
    .catch(() => {});
}
