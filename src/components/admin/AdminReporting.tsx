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
  totalMatches: number;
  completedMatches: number;
  activeMatches: number;
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

      // Fetch private profile data to get subscription tiers
      const usersWithTiers = await Promise.all(
        profiles.map(async (profile) => {
          const { data } = await supabase.rpc('get_user_private_data', {
            _user_id: profile.user_id
          });
          return {
            ...profile,
            tier: data?.[0]?.membership_tier || 'Free'
          };
        })
      );

      const freeUsers = usersWithTiers.filter(u => u.tier === 'Free').length;
      const localUsers = usersWithTiers.filter(u => u.tier === 'local').length;
      const tournamentUsers = usersWithTiers.filter(u => u.tier === 'tournament').length;

      // Fetch match statistics
      const { data: matches, error: matchesError } = await supabase
        .from('matches')
        .select('status');

      if (matchesError) throw matchesError;

      const completedMatches = matches.filter(m => m.status === 'completed').length;
      const activeMatches = matches.filter(m => m.status === 'started').length;

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
        totalMatches: matches.length,
        completedMatches,
        activeMatches,
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
              {reportData.freeUsers} free, {reportData.localUsers + reportData.tournamentUsers} paid
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
              {reportData.completedMatches} completed, {reportData.activeMatches} active
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
                  <div className="h-3 w-3 rounded-full bg-muted" />
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
                  <div className="h-3 w-3 rounded-full bg-primary" />
                  <span className="text-sm">Local Player</span>
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
                  <div className="h-3 w-3 rounded-full bg-accent" />
                  <span className="text-sm">Tournament Pro</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{reportData.tournamentUsers}</span>
                  <span className="text-sm text-muted-foreground">
                    ({Math.round((reportData.tournamentUsers / reportData.totalUsers) * 100)}%)
                  </span>
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
                <span className="text-sm">Completion Rate</span>
                <span className="text-sm font-medium">
                  {reportData.totalMatches > 0
                    ? Math.round((reportData.completedMatches / reportData.totalMatches) * 100)
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
