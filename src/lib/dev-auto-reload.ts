/**
 * Dev-only auto cache-bust reloader.
 *
 * Polls the live `index.html` for changes to its main entry-script URL
 * (Vite emits a fresh `?t=` query on each HMR cycle, and rebuilds change
 * the script src entirely). When the script URL we booted with no longer
 * matches the one currently being served, we know the user is looking at
 * stale assets — so we trigger ONE hard reload with a cache-bust param.
 *
 * - No service worker involved.
 * - Only runs in dev/preview hosts; production builds skip this entirely.
 * - Session-guarded so a single mismatch can never cause an infinite loop.
 */

const RELOAD_GUARD_KEY = "tyche-cache-bust-reloaded";
const POLL_INTERVAL_MS = 4000;

const isDevHost = (): boolean => {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname;
  return (
    import.meta.env.DEV ||
    host === "localhost" ||
    host === "127.0.0.1" ||
    host.endsWith(".lovable.app") ||
    host.endsWith(".lovableproject.com")
  );
};

const getCurrentEntryScript = (): string | null => {
  // The first <script type="module" src="..."> in <head> is the Vite entry.
  const scripts = document.head.querySelectorAll<HTMLScriptElement>(
    'script[type="module"][src]',
  );
  for (const s of scripts) {
    const src = s.getAttribute("src") || "";
    if (src.includes("/src/") || src.includes("/@vite/") || src.includes("/assets/")) {
      // Strip the cache-bust query so we compare the underlying file URL.
      return src.split("?")[0];
    }
  }
  return null;
};

const fetchLatestEntryScript = async (): Promise<string | null> => {
  try {
    const res = await fetch(`/?_cb=${Date.now()}`, {
      cache: "no-store",
      headers: { Accept: "text/html" },
    });
    if (!res.ok) return null;
    const html = await res.text();
    // Match the first module script src in the served HTML.
    const match = html.match(
      /<script[^>]+type=["']module["'][^>]+src=["']([^"']+)["']/i,
    );
    if (!match) return null;
    return match[1].split("?")[0];
  } catch {
    return null;
  }
};

const reloadOnce = () => {
  // Prevent reload loops: once we've reloaded for a given mismatch,
  // do not reload again until the user manually navigates.
  if (sessionStorage.getItem(RELOAD_GUARD_KEY)) return;
  sessionStorage.setItem(RELOAD_GUARD_KEY, "1");
  const url = new URL(window.location.href);
  url.searchParams.set("_cb", Date.now().toString());
  window.location.replace(url.toString());
};

export function startDevAutoReload(): void {
  if (typeof window === "undefined") return;
  if (!isDevHost()) return;

  // Reset the guard whenever the user actively navigates within the app
  // so a future stale build can still trigger one fresh reload.
  window.addEventListener("popstate", () => {
    sessionStorage.removeItem(RELOAD_GUARD_KEY);
  });

  const initialEntry = getCurrentEntryScript();
  if (!initialEntry) return;

  let polling = false;
  const check = async () => {
    if (polling) return;
    if (document.visibilityState !== "visible") return;
    polling = true;
    try {
      const latest = await fetchLatestEntryScript();
      if (latest && latest !== initialEntry) {
        reloadOnce();
      }
    } finally {
      polling = false;
    }
  };

  // Check immediately on visibility change (user tabs back in)
  // and on a slow interval while the tab is foregrounded.
  document.addEventListener("visibilitychange", check);
  window.addEventListener("focus", check);
  window.setInterval(check, POLL_INTERVAL_MS);
}
