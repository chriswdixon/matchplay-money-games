import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App.tsx";
import "./index.css";
import { AuthProvider } from "@/hooks/useAuth";
import { SubscriptionProvider } from "@/hooks/useSubscription";
import { ThemeProvider } from "@/components/ThemeProvider";
import { Toaster } from "@/components/ui/toaster";
import { runPreviewCacheGuard } from "@/lib/preview-cache-guard";
import { startDevAutoReload } from "@/lib/dev-auto-reload";
import { registerPWA } from "@/lib/pwa-register";

// Clean up legacy SW + caches when running in unsafe contexts (Lovable preview iframes).
runPreviewCacheGuard();

// Detect new builds in dev/preview and force a single hard refresh.
startDevAutoReload();

// Register the PWA service worker in production hosts only.
void registerPWA();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ThemeProvider defaultTheme="system" storageKey="tyche-theme">
          <AuthProvider>
            <SubscriptionProvider>
              <App />
              <Toaster />
            </SubscriptionProvider>
          </AuthProvider>
        </ThemeProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>
);
