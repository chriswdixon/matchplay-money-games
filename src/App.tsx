import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ActiveMatchProvider } from "@/hooks/useActiveMatch";
import { Routes, Route } from "react-router-dom";
import { EmailConfirmationBanner } from "@/components/auth/EmailConfirmationBanner";
import { OfflineIndicator } from "@/components/OfflineIndicator";
import { PWAUpdatePrompt } from "@/components/PWAUpdatePrompt";
import { CookieConsent } from "@/components/CookieConsent";
import { GeoBlockingProvider } from "@/hooks/useGeoBlocking";
import { GeoBlockingOverlay } from "@/components/GeoBlockingOverlay";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Profile from "./pages/Profile";
import NotFound from "./pages/NotFound";
import ResetPassword from "./pages/ResetPassword";
import AdminConsole from "./pages/AdminConsole";
import CreateMatch from "./pages/CreateMatch";
import VerifyEmail from "./pages/VerifyEmail";
import VerifyAge from "./pages/VerifyAge";
import Install from "./pages/Install";
import Terms from "./pages/Terms";
import Privacy from "./pages/Privacy";

const App = () => (
  <GeoBlockingProvider>
    <ActiveMatchProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <GeoBlockingOverlay />
        <EmailConfirmationBanner />
        <OfflineIndicator />
        <PWAUpdatePrompt />
        <CookieConsent />
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
      </TooltipProvider>
    </ActiveMatchProvider>
  </GeoBlockingProvider>
);

export default App;
