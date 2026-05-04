/**
 * Preview Cache Guard
 *
 * Cleans up service workers ONLY in unsafe contexts (Lovable preview iframes,
 * preview hosts). In production hosts we leave the SW alone so the PWA works.
 */

const RELOAD_FLAG = "tyche-cache-guard-reloaded";

function isUnsafeSwContext(): boolean {
  if (typeof window === "undefined") return false;
  let inIframe = false;
  try {
    inIframe = window.self !== window.top;
  } catch {
    inIframe = true;
  }
  const host = window.location.hostname;
  const isPreviewHost =
    host.includes("id-preview--") ||
    host.includes("preview--") ||
    host.endsWith(".lovableproject.com") ||
    host.endsWith(".lovableproject-dev.com");
  return inIframe || isPreviewHost;
}

export function runPreviewCacheGuard(): void {
  if (typeof window === "undefined") return;
  if (!isUnsafeSwContext()) return;

  if ("caches" in window) {
    void caches
      .keys()
      .then((names) => Promise.all(names.map((n) => caches.delete(n))))
      .catch(() => {});
  }

  const sw = navigator.serviceWorker;
  if (!sw) return;

  void sw
    .getRegistrations()
    .then(async (regs) => {
      if (regs.length === 0) return;
      await Promise.all(regs.map((r) => r.unregister().catch(() => false)));
      if (sessionStorage.getItem(RELOAD_FLAG)) return;
      sessionStorage.setItem(RELOAD_FLAG, "1");
      const url = new URL(window.location.href);
      url.searchParams.set("cache-bust", Date.now().toString(36));
      window.location.replace(url.toString());
    })
    .catch(() => {});
}
