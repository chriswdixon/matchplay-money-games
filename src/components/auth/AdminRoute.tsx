import { ReactNode, useEffect } from "react";
import { Navigate, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useAdminRole } from "@/hooks/useAdminRole";
import { toast } from "sonner";

/**
 * Route guard restricting access to admin-only pages.
 *
 * Defense-in-depth: this complements (does not replace) the server-side
 * has_role() checks enforced inside edge functions and RLS policies.
 */
interface AdminRouteProps {
  children: ReactNode;
}

export const AdminRoute = ({ children }: AdminRouteProps) => {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: roleLoading } = useAdminRole();
  const navigate = useNavigate();
  const location = useLocation();

  const loading = authLoading || roleLoading;

  useEffect(() => {
    if (!loading && user && !isAdmin) {
      toast.error("Access denied: admin privileges required.");
      navigate("/", { replace: true });
    }
  }, [loading, user, isAdmin, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" />
          <p className="text-muted-foreground">Verifying access…</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace state={{ from: location.pathname + location.search }} />;
  }

  if (!isAdmin) {
    return null;
  }

  return <>{children}</>;
};

export default AdminRoute;
