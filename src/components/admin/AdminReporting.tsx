import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Users, CreditCard, Target, TrendingUp, DollarSign } from "lucide-react";

interface ReportData {
  totalUsers: number;
  freeUsers: number;
  localUsers: number;
  tournamentUsers: number;
  adminUsers: number;
  totalMatches: number;
  completedMatches: number;
  activeMatches: number;
  cancelledMatches: number;
  userGrowth: Array<{ date: string; count: number }>;
}

const AdminReporting = () => {
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchReportData();
  }, []);

  const fetchReportData = async () => {
    setLoading(true);
    try {
      // Fetch user counts
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, created_at');

      if (profilesError) throw profilesError;

      // Fetch private profile data and admin roles
      const usersWithTiers = await Promise.all(
        profiles.map(async (profile) => {
          const { data: privateData } = await supabase.rpc('get_user_private_data', {
            _user_id: profile.user_id
          });
          
          // Check if user is admin
          const { data: adminRole } = await supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', profile.user_id)
            .eq('role', 'admin')
            .maybeSingle();
          
          const tier = privateData?.[0]?.membership_tier || 'Free';
          
          // Log specific user for debugging
          if (profile.user_id === '19a51ba2-1b49-475d-82f4-29c7b4d1b190') {
            console.log('DEBUG: Tournament user data:', {
              user_id: profile.user_id,
              rawPrivateData: privateData,
              extractedTier: tier,
              isAdmin: !!adminRole
            });
          }
          
          return {
            ...profile,
            tier,
            isAdmin: !!adminRole
          };
        })
      );

      const adminUsers = usersWithTiers.filter(u => u.isAdmin).length;
      const freeUsers = usersWithTiers.filter(u => u.tier.toLowerCase() === 'free').length;
      const localUsers = usersWithTiers.filter(u => (u.tier.toLowerCase() === 'local' || u.tier.toLowerCase() === 'local play')).length;
      const tournamentUsers = usersWithTiers.filter(u => u.tier.toLowerCase() === 'tournament').length;

      // Fetch match statistics
      const { data: matches, error: matchesError } = await supabase
        .from('matches')
        .select('status');

      if (matchesError) throw matchesError;

      const completedMatches = matches.filter(m => m.status === 'completed').length;
      const activeMatches = matches.filter(m => m.status === 'started').length;
      const cancelledMatches = matches.filter(m => m.status === 'cancelled').length;

      // Calculate user growth (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const userGrowth = profiles
        .filter(p => new Date(p.created_at) >= thirtyDaysAgo)
        .reduce((acc, profile) => {
          const date = new Date(profile.created_at).toLocaleDateString();
          const existing = acc.find(item => item.date === date);
          if (existing) {
            existing.count++;
          } else {
            acc.push({ date, count: 1 });
          }
          return acc;
        }, [] as Array<{ date: string; count: number }>);

      setReportData({
        totalUsers: profiles.length,
        freeUsers,
        localUsers,
        tournamentUsers,
        adminUsers,
        totalMatches: matches.length,
        completedMatches,
        activeMatches,
        cancelledMatches,
        userGrowth,
      });
    } catch (error) {
      console.error('Error fetching report data:', error);
      toast({
        title: "Error",
        description: "Failed to load report data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  if (!reportData) {
    return (
      <Card>
        <CardContent className="text-center py-12">
          <p className="text-muted-foreground">No data available</p>
        </CardContent>
      </Card>
    );
  }

  const monthlyRevenue = (reportData.localUsers * 29) + (reportData.tournamentUsers * 79);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{reportData.totalUsers}</div>
            <p className="text-xs text-muted-foreground">
              {reportData.freeUsers} free, {reportData.localUsers + reportData.tournamentUsers} paid ({reportData.adminUsers} admins)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monthly Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${monthlyRevenue.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              Estimated based on subscriptions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Matches</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{reportData.totalMatches}</div>
            <p className="text-xs text-muted-foreground">
              {reportData.completedMatches} completed, {reportData.activeMatches} active, {reportData.cancelledMatches} cancelled
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">User Growth</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{reportData.userGrowth.length}</div>
            <p className="text-xs text-muted-foreground">
              New users last 30 days
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Subscription Breakdown</CardTitle>
            <CardDescription>Distribution of users by subscription tier</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-secondary" />
                  <span className="text-sm">Free</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{reportData.freeUsers}</span>
                  <span className="text-sm text-muted-foreground">
                    ({Math.round((reportData.freeUsers / reportData.totalUsers) * 100)}%)
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-success" />
                  <span className="text-sm">Local Play</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{reportData.localUsers}</span>
                  <span className="text-sm text-muted-foreground">
                    ({Math.round((reportData.localUsers / reportData.totalUsers) * 100)}%)
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-warning" />
                  <span className="text-sm">Tournament</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{reportData.tournamentUsers}</span>
                  <span className="text-sm text-muted-foreground">
                    ({Math.round((reportData.tournamentUsers / reportData.totalUsers) * 100)}%)
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between border-t pt-4">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-destructive" />
                  <span className="text-sm font-medium">Admin Users</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{reportData.adminUsers}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Match Activity</CardTitle>
            <CardDescription>Overview of match statistics</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm">Completed Matches</span>
                <span className="text-sm font-medium">{reportData.completedMatches}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Active Matches</span>
                <span className="text-sm font-medium">{reportData.activeMatches}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Cancelled Matches</span>
                <span className="text-sm font-medium">{reportData.cancelledMatches}</span>
              </div>
              <div className="flex items-center justify-between border-t pt-4">
                <span className="text-sm font-medium">Completion Rate</span>
                <span className="text-sm font-medium">
                  {(reportData.completedMatches + reportData.cancelledMatches) > 0
                    ? Math.round((reportData.completedMatches / (reportData.completedMatches + reportData.cancelledMatches)) * 100)
                    : 0}%
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminReporting;
