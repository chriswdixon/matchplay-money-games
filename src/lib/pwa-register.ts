/**
 * Production-only service worker registration.
 * Skipped in dev, in iframes, and on Lovable preview hosts.
 */
export async function registerPWA(): Promise<void> {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;
  if (import.meta.env.DEV) return;

  let inIframe = false;
  try {
    inIframe = window.self !== window.top;
  } catch {
    inIframe = true;
  }
  if (inIframe) return;

  const host = window.location.hostname;
  const isPreviewHost =
    host.includes("id-preview--") ||
    host.includes("preview--") ||
    host.endsWith(".lovableproject.com") ||
    host.endsWith(".lovableproject-dev.com");
  if (isPreviewHost) return;

  try {
    const { registerSW } = await import("virtual:pwa-register");
    const updateSW = registerSW({
      immediate: true,
      onNeedRefresh() {
        // New SW available — activate and reload so updated icons/manifest take effect.
        void updateSW(true);
      },
      onRegisteredSW(_swUrl, registration) {
        if (!registration) return;
        // Check for updates immediately and then every 60s while the tab is open.
        void registration.update();
        setInterval(() => {
          void registration.update();
        }, 60_000);
      },
    });
  } catch (err) {
    console.warn("[PWA] registration skipped:", err);
  }
}
