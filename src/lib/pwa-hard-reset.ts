/**
 * Hard reset: unregister all service workers, delete every Cache Storage entry,
 * clear sessionStorage flags, and reload with a cache-bust query string so the
 * browser refetches the latest manifest, icons, and HTML.
 *
 * Use for: forcing PWA icon/manifest refresh after a brand update.
 * Does NOT touch localStorage (auth + user prefs survive).
 */
export async function hardResetPwaCaches(): Promise<void> {
  try {
    // 1) Unregister every service worker registration for this origin.
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister().catch(() => false)));
    }

    // 2) Wipe Cache Storage (Workbox runtime caches, precache, etc.).
    if ("caches" in window) {
      const names = await caches.keys();
      await Promise.all(names.map((n) => caches.delete(n)));
    }

    // 3) Clear our own session-scoped reload guard flags so guards rerun cleanly.
    try {
      sessionStorage.removeItem("tyche-cache-guard-reloaded");
      sessionStorage.removeItem("tyche-preboot-cache-bust");
    } catch {
      /* noop */
    }
  } catch (err) {
    console.warn("[PWA] hard reset partial failure:", err);
  }

  // 4) Reload with a cache-bust param so the SW + HTML + manifest are refetched.
  const url = new URL(window.location.href);
  url.searchParams.set("pwa-reset", Date.now().toString(36));
  window.location.replace(url.toString());
}
