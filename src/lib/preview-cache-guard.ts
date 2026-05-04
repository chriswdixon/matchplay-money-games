/**
 * Preview Cache Guard
 *
 * Ensures the Lovable preview (and any deployed instance) never gets stuck on
 * a stale service worker or HTTP cache from a previous PWA build.
 *
 * Constraints:
 *  - No service worker is registered here (No-PWA CI guard).
 *  - No vite-plugin-pwa, no Workbox, no manifest.
 *  - Only uses standard browser APIs to *clean up* legacy state.
 *
 * Behaviour:
 *  1. On every load, unregister any leftover service workers.
 *  2. Purge the Cache Storage API (legacy Workbox caches).
 *  3. If we actually found and removed a SW, do a single cache-busted
 *     reload so the page re-fetches fresh hashed assets — guarded by
 *     sessionStorage so we never loop.
 */

const RELOAD_FLAG = "tyche-cache-guard-reloaded";

export function runPreviewCacheGuard(): void {
  if (typeof window === "undefined") return;

  // Always purge Cache Storage (cheap, safe, no-op if empty).
  if ("caches" in window) {
    void caches
      .keys()
      .then((names) => Promise.all(names.map((n) => caches.delete(n))))
      .catch(() => {
        /* ignore */
      });
  }

  // Unregister any service worker left over from a previous PWA build.
  // We intentionally do NOT call navigator.serviceWorker.register anywhere.
  const sw = navigator.serviceWorker;
  if (!sw) return;

  void sw
    .getRegistrations()
    .then(async (regs) => {
      if (regs.length === 0) return;

      await Promise.all(regs.map((r) => r.unregister().catch(() => false)));

      // Only force-reload once per tab to avoid loops.
      if (sessionStorage.getItem(RELOAD_FLAG)) return;
      sessionStorage.setItem(RELOAD_FLAG, "1");

      const url = new URL(window.location.href);
      url.searchParams.set("cache-bust", Date.now().toString(36));
      window.location.replace(url.toString());
    })
    .catch(() => {
      /* ignore */
    });
}
