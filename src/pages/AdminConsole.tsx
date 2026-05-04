import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAdminRole } from "@/hooks/useAdminRole";
import { useIsMobile } from "@/hooks/use-mobile";

import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { Users, Ticket, BarChart3, AlertCircle, Mail, Database, Share2, TrendingUp, Trash2, Globe, ShieldCheck, LifeBuoy, X } from "lucide-react";
import { SupportRequests } from "@/components/admin/SupportRequests";
import { AuditLog } from "@/components/admin/AuditLog";
import { PageTitleCard } from "@/components/ui/page-title-card";
import { AuditAlerts } from "@/components/admin/AuditAlerts";
import UserManagement from "@/components/admin/UserManagement";
import CouponManagement from "@/components/admin/CouponManagement";
import AdminReporting from "@/components/admin/AdminReporting";
import { AdminNotifications } from "@/components/admin/AdminNotifications";

import { CancellationReviews } from "@/components/admin/CancellationReviews";
import { IncompleteMatchReviews } from "@/components/admin/IncompleteMatchReviews";
import { InviteManagement } from "@/components/admin/InviteManagement";
import { GolfDataImport } from "@/components/admin/GolfDataImport";

import { SocialLinksManagement } from "@/components/admin/SocialLinksManagement";

import { MatchManagement } from "@/components/admin/MatchManagement";
import { DeletionRequestReviews } from "@/components/admin/DeletionRequestReviews";
import { GeoBlockingManagement } from "@/components/admin/GeoBlockingManagement";

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
  const isMobile = useIsMobile();
  const [activeTab, setActiveTab] = useState("reports");
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
    <div className="min-h-screen bg-muted/40">
      <main className="container mx-auto py-8 px-4">
        <div className="mb-8">
          <PageTitleCard
            icon={<ShieldCheck className="w-5 h-5" aria-hidden="true" />}
            title="Admin Console"
            description="Manage users, coupons, and view reports"
          />
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TooltipProvider delayDuration={200}>
            <nav
              aria-label="Admin sections"
              className={cn(
                'z-30 px-2 pointer-events-none',
                isMobile ? 'sticky top-2 mb-4' : 'sticky top-4 mb-6'
              )}
            >
              <div className="mx-auto max-w-5xl pointer-events-auto">
                <div
                  className={cn(
                    "bg-foreground text-background shadow-premium",
                    isMobile
                      ? "flex flex-wrap items-center justify-center gap-1 rounded-3xl px-2 py-2"
                      : "flex items-center gap-1 rounded-full px-2 py-2 overflow-x-auto scrollbar-hide justify-between"
                  )}
                >
                  {[
                    { id: 'reports', label: 'Reports', Icon: BarChart3 },
                    { id: 'matches', label: 'Matches', Icon: TrendingUp },
                    { id: 'users', label: 'Users', Icon: Users },
                    { id: 'invites', label: 'Invites', Icon: Mail },
                    { id: 'coupons', label: 'Coupons', Icon: Ticket },
                    { id: 'reviews', label: 'Reviews', Icon: AlertCircle },
                    { id: 'deletions', label: 'Deletions', Icon: Trash2 },
                    { id: 'geo', label: 'Geo', Icon: Globe },
                    { id: 'golf-data', label: 'Golf Data', Icon: Database },
                    { id: 'social', label: 'Social', Icon: Share2 },
                    { id: 'support', label: 'Support', Icon: LifeBuoy },
                    { id: 'audit', label: 'Audit', Icon: ShieldCheck },
                  ].map(({ id, label, Icon }) => {
                    const active = id === activeTab;
                    return (
                      <Tooltip key={id}>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            onClick={() => setActiveTab(id)}
                            aria-label={label}
                            aria-current={active ? 'page' : undefined}
                            className={cn(
                              'relative flex items-center justify-center rounded-full transition-all w-10 h-10 shrink-0',
                              active
                                ? 'bg-primary text-primary-foreground shadow-[0_0_20px_hsl(var(--primary)/0.6)]'
                                : 'text-background/90 hover:text-background hover:bg-background/10 hover:shadow-[0_0_20px_hsl(var(--primary)/0.5)]'
                            )}
                          >
                            <Icon className="w-5 h-5" strokeWidth={active ? 2.5 : 2} aria-hidden="true" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">{label}</TooltipContent>
                      </Tooltip>
                    );
                  })}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={() => navigate('/profile')}
                        aria-label="Exit Admin Console"
                        className="relative flex items-center justify-center rounded-full transition-all w-10 h-10 shrink-0 text-background/90 hover:text-background hover:bg-destructive/80 ml-1"
                      >
                        <X className="w-5 h-5" strokeWidth={2.5} aria-hidden="true" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">Exit</TooltipContent>
                  </Tooltip>
                </div>
              </div>
            </nav>
          </TooltipProvider>

          <TabsContent value="matches">
            <MatchManagement />
          </TabsContent>

          <TabsContent value="users">
            <UserManagement />
          </TabsContent>



          <TabsContent value="invites">
            <InviteManagement />
          </TabsContent>

            <TabsContent value="coupons">
              <CouponManagement />
            </TabsContent>
            
            <TabsContent value="reviews" className="space-y-6">
              <IncompleteMatchReviews />
              <CancellationReviews />
            </TabsContent>

            <TabsContent value="deletions">
              <DeletionRequestReviews />
            </TabsContent>

            <TabsContent value="geo">
              <GeoBlockingManagement />
            </TabsContent>
            
            <TabsContent value="reports" className="space-y-6">
              <AdminNotifications onNavigate={setActiveTab} />
              <AdminReporting />
            </TabsContent>

            <TabsContent value="golf-data">
              <GolfDataImport />
            </TabsContent>

            <TabsContent value="social">
              <SocialLinksManagement />
            </TabsContent>

            <TabsContent value="support">
              <SupportRequests />
            </TabsContent>

            <TabsContent value="audit" className="space-y-6">
              <AuditAlerts />
              <AuditLog />
            </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default AdminConsole;
