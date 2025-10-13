import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAdminRole } from "@/hooks/useAdminRole";
import AppHeader from "@/components/AppHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, Ticket, BarChart3, DollarSign, AlertCircle } from "lucide-react";
import UserManagement from "@/components/admin/UserManagement";
import CouponManagement from "@/components/admin/CouponManagement";
import AdminReporting from "@/components/admin/AdminReporting";
import { UserAccountDetails } from "@/components/admin/UserAccountDetails";
import { CancellationReviews } from "@/components/admin/CancellationReviews";

/**
 * SECURITY NOTE: Admin UI Access Control
 * 
 * This component checks admin status client-side for UI convenience only.
 * All actual admin operations (disable user, create coupons, etc.) are 
 * protected by server-side validation in edge functions using the has_role() 
 * security definer function.
 * 
 * Even if a user bypasses this client-side check, they cannot execute any 
 * admin operations without proper server-side authorization.
 */
const AdminConsole = () => {
  const { isAdmin, loading } = useAdminRole();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !isAdmin) {
      navigate('/');
    }
  }, [isAdmin, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Loading admin console...</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <AppHeader hideReturnButton />
      <main className="container mx-auto py-8 px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Admin Console</h1>
          <p className="text-muted-foreground">Manage users, coupons, and view reports</p>
        </div>

        <Tabs defaultValue="users" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5 lg:w-auto">
            <TabsTrigger value="users" className="gap-2">
              <Users className="h-4 w-4" />
              User Management
            </TabsTrigger>
            <TabsTrigger value="accounts" className="gap-2">
              <DollarSign className="h-4 w-4" />
              Accounts
            </TabsTrigger>
            <TabsTrigger value="coupons" className="gap-2">
              <Ticket className="h-4 w-4" />
              Trial Coupons
            </TabsTrigger>
            <TabsTrigger value="reviews" className="gap-2">
              <AlertCircle className="h-4 w-4" />
              Reviews
            </TabsTrigger>
            <TabsTrigger value="reports" className="gap-2">
              <BarChart3 className="h-4 w-4" />
              Reports
            </TabsTrigger>
          </TabsList>

          <TabsContent value="users">
            <UserManagement />
          </TabsContent>

          <TabsContent value="accounts">
            <UserAccountDetails />
          </TabsContent>

            <TabsContent value="coupons">
              <CouponManagement />
            </TabsContent>
            
            <TabsContent value="reviews">
              <CancellationReviews />
            </TabsContent>
            
            <TabsContent value="reports">
              <AdminReporting />
            </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default AdminConsole;
