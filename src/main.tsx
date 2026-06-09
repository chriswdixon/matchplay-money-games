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
import { cleanupServiceWorkers } from "@/lib/sw-cleanup";
import { toast as sonnerToast } from "sonner";

// Globally suppress success / informational toasts; only errors are surfaced.
const noop = () => "" as unknown as string | number;
sonnerToast.success = noop as typeof sonnerToast.success;
sonnerToast.info = noop as typeof sonnerToast.info;
sonnerToast.message = noop as typeof sonnerToast.message;

// Evict any legacy service worker + caches so the app never serves stale HTML.
cleanupServiceWorkers();

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
