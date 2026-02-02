import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ActiveMatchProvider } from "@/hooks/useActiveMatch";
import { Routes, Route } from "react-router-dom";
import { EmailConfirmationBanner } from "@/components/auth/EmailConfirmationBanner";
import { GeoBlockingProvider } from "@/hooks/useGeoBlocking";

// Eager load the landing page for fastest initial render
import Index from "./pages/Index";

// Lazy load non-critical overlays
const OfflineIndicator = lazy(() => import("@/components/OfflineIndicator").then(m => ({ default: m.OfflineIndicator })));
const PWAUpdatePrompt = lazy(() => import("@/components/PWAUpdatePrompt").then(m => ({ default: m.PWAUpdatePrompt })));
const CookieConsent = lazy(() => import("@/components/CookieConsent").then(m => ({ default: m.CookieConsent })));
const GeoBlockingOverlay = lazy(() => import("@/components/GeoBlockingOverlay").then(m => ({ default: m.GeoBlockingOverlay })));

// Lazy load all other pages for code splitting
const Auth = lazy(() => import("./pages/Auth"));
const Profile = lazy(() => import("./pages/Profile"));
const NotFound = lazy(() => import("./pages/NotFound"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const AdminConsole = lazy(() => import("./pages/AdminConsole"));
const CreateMatch = lazy(() => import("./pages/CreateMatch"));
const VerifyEmail = lazy(() => import("./pages/VerifyEmail"));
const VerifyAge = lazy(() => import("./pages/VerifyAge"));
const Install = lazy(() => import("./pages/Install"));
const Terms = lazy(() => import("./pages/Terms"));
const Privacy = lazy(() => import("./pages/Privacy"));

// Minimal loading fallback to avoid layout shift
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="animate-pulse text-muted-foreground">Loading...</div>
  </div>
);

const App = () => (
  <GeoBlockingProvider>
    <ActiveMatchProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <Suspense fallback={null}>
          <GeoBlockingOverlay />
        </Suspense>
        <EmailConfirmationBanner />
        <Suspense fallback={null}>
          <OfflineIndicator />
          <PWAUpdatePrompt />
          <CookieConsent />
        </Suspense>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/auth/reset-password" element={<ResetPassword />} />
            <Route path="/verify" element={<VerifyEmail />} />
            <Route path="/verify-age" element={<VerifyAge />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/admin" element={<AdminConsole />} />
            <Route path="/create-match" element={<CreateMatch />} />
            <Route path="/install" element={<Install />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/privacy" element={<Privacy />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </TooltipProvider>
    </ActiveMatchProvider>
  </GeoBlockingProvider>
);

export default App;
