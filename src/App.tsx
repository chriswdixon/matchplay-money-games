import GolfBallLoader from "@/components/GolfBallLoader";
import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ActiveMatchProvider } from "@/hooks/useActiveMatch";
import { Routes, Route, Navigate } from "react-router-dom";
import { EmailConfirmationBanner } from "@/components/auth/EmailConfirmationBanner";
import { GeoBlockingProvider } from "@/hooks/useGeoBlocking";

// Eager load the landing page for fastest initial render
import Index from "./pages/Index";

// Lazy load non-critical overlays
const OfflineIndicator = lazy(() => import("@/components/OfflineIndicator").then(m => ({ default: m.OfflineIndicator })));

const CookieConsent = lazy(() => import("@/components/CookieConsent").then(m => ({ default: m.CookieConsent })));
const GeoBlockingOverlay = lazy(() => import("@/components/GeoBlockingOverlay").then(m => ({ default: m.GeoBlockingOverlay })));
const PWAInstallOnLogin = lazy(() => import("@/components/PWAInstallOnLogin").then(m => ({ default: m.PWAInstallOnLogin })));
const ScrollProgress = lazy(() => import("@/components/ScrollProgress").then(m => ({ default: m.ScrollProgress })));

// Lazy load all other pages for code splitting
const Auth = lazy(() => import("./pages/Auth"));
const Profile = lazy(() => import("./pages/Profile"));
const NotFound = lazy(() => import("./pages/NotFound"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const AdminConsole = lazy(() => import("./pages/AdminConsole"));
import { AdminRoute } from "./components/auth/AdminRoute";
const CreateMatch = lazy(() => import("./pages/CreateMatch"));
const MatchDetails = lazy(() => import("./pages/MatchDetails"));
const VerifyEmail = lazy(() => import("./pages/VerifyEmail"));
const VerifyAge = lazy(() => import("./pages/VerifyAge"));

const Terms = lazy(() => import("./pages/Terms"));
const Privacy = lazy(() => import("./pages/Privacy"));
const WinsFeed = lazy(() => import("./pages/WinsFeed"));
const HandicapCalculatorsPage = lazy(() => import("./pages/HandicapCalculatorsPage"));
const WalletPage = lazy(() => import("./pages/Wallet"));
const FAQ = lazy(() => import("./pages/FAQ"));
const MyMatches = lazy(() => import("./pages/MyMatches"));

// Minimal loading fallback to avoid layout shift
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <GolfBallLoader size={64} showBrand />
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
          <CookieConsent />
          <PWAInstallOnLogin />
          <ScrollProgress />
        </Suspense>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/auth/reset-password" element={<ResetPassword />} />
            <Route path="/verify" element={<VerifyEmail />} />
            <Route path="/verify-age" element={<VerifyAge />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/admin" element={<AdminRoute><AdminConsole /></AdminRoute>} />
            <Route path="/create-match" element={<CreateMatch />} />
            <Route path="/match/:id" element={<MatchDetails />} />
            
            <Route path="/terms" element={<Terms />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/wins" element={<WinsFeed />} />
            <Route path="/handicap-calculators" element={<HandicapCalculatorsPage />} />
            <Route path="/wallet" element={<WalletPage />} />
            <Route path="/faq" element={<FAQ />} />
            {/* PWA install flow has been removed — always send /install (and any sub-paths) to NotFound */}
            <Route path="/install" element={<Navigate to="/404" replace />} />
            <Route path="/install/*" element={<Navigate to="/404" replace />} />
            <Route path="/404" element={<NotFound />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </TooltipProvider>
    </ActiveMatchProvider>
  </GeoBlockingProvider>
);

export default App;
