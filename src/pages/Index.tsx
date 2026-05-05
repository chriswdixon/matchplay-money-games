import { lazy, Suspense } from "react";
import { useAuth } from "@/hooks/useAuth";
import GolfBallLoader from "@/components/GolfBallLoader";

// Split the two experiences into separate chunks so visitors never download
// the authenticated dashboard, and vice versa.
const TychePublicLanding = lazy(() => import("./TychePublicLanding"));
const TycheDashboard = lazy(() => import("./TycheDashboard"));

const RouteFallback = () => (
  <div className="min-h-screen bg-background flex items-center justify-center">
    <GolfBallLoader showBrand />
  </div>
);

const Index = () => {
  const { user, loading } = useAuth();

  if (loading) return <RouteFallback />;

  return (
    <Suspense fallback={<RouteFallback />}>
      {user ? <TycheDashboard /> : <TychePublicLanding />}
    </Suspense>
  );
};

export default Index;
