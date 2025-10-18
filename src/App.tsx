import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ActiveMatchProvider } from "@/hooks/useActiveMatch";
import { Routes, Route } from "react-router-dom";
import { EmailConfirmationBanner } from "@/components/auth/EmailConfirmationBanner";
import { OfflineIndicator } from "@/components/OfflineIndicator";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Profile from "./pages/Profile";
import NotFound from "./pages/NotFound";
import ResetPassword from "./pages/ResetPassword";
import AdminConsole from "./pages/AdminConsole";
import CreateMatch from "./pages/CreateMatch";
import VerifyEmail from "./pages/VerifyEmail";
import Install from "./pages/Install";

const App = () => (
  <ActiveMatchProvider>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <EmailConfirmationBanner />
      <OfflineIndicator />
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/auth/reset-password" element={<ResetPassword />} />
        <Route path="/verify" element={<VerifyEmail />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/admin" element={<AdminConsole />} />
        <Route path="/create-match" element={<CreateMatch />} />
        <Route path="/install" element={<Install />} />
        {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </TooltipProvider>
  </ActiveMatchProvider>
);

export default App;
