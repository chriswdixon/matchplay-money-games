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
    const [{ registerSW }, { toast }] = await Promise.all([
      import("virtual:pwa-register"),
      import("sonner"),
    ]);
    const updateSW = registerSW({
      immediate: true,
      onNeedRefresh() {
        // Surface an "outdated" notice so installed PWAs know a new version is available.
        toast("A new version is available", {
          description: "You're viewing an outdated version of Tyche.",
          duration: Infinity,
          important: true,
          action: {
            label: "Update now",
            onClick: () => {
              void updateSW(true);
            },
          },
        });
      },
      onRegisteredSW(_swUrl, registration) {
        if (!registration) return;
        // Check for updates immediately, on focus/visibility, and every 60s.
        void registration.update();
        const check = () => {
          void registration.update();
        };
        window.addEventListener("focus", check);
        document.addEventListener("visibilitychange", () => {
          if (document.visibilityState === "visible") check();
        });
        setInterval(check, 60_000);
      },
    });
  } catch (err) {
    console.warn("[PWA] registration skipped:", err);
  }
}
