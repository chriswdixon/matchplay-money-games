import { lazy, Suspense, useEffect, useState, useMemo } from "react";
import AppHeader from "@/components/AppHeader";
import { Search, Crown, ArrowUp, History, Trophy, Target } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useActiveMatch } from "@/hooks/useActiveMatch";
import { useSearchParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import HomeProfileCard from "@/components/home/HomeProfileCard";
import HomeSearchBar from "@/components/home/HomeSearchBar";
import RecentlyPlayedCourses from "@/components/home/RecentlyPlayedCourses";
import BottomTabBar, { type BottomTab } from "@/components/home/BottomTabBar";
import HeroThemeSwitcher, { applyHeroTheme, getStoredHeroTheme } from "@/components/HeroThemeSwitcher";

const MatchFinder = lazy(() => import("@/components/MatchFinder"));
const SubscriptionManagement = lazy(() => import("@/components/SubscriptionManagement"));
const HandicapSettings = lazy(() => import("@/components/profile/HandicapSettings").then(m => ({ default: m.HandicapSettings })));
const MatchScorecard = lazy(() => import("@/components/MatchScorecard").then(m => ({ default: m.MatchScorecard })));

const TabLoader = () => (
  <div className="flex items-center justify-center py-12">
    <div className="animate-pulse text-muted-foreground">Loading...</div>
  </div>
);

const TycheDashboard = () => {
  const { user } = useAuth();
  const { hasActiveMatch, activeMatchId, activeMatchName } = useActiveMatch();
  const [currentTab, setCurrentTab] = useState("home");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    applyHeroTheme(getStoredHeroTheme());
  }, []);

  useEffect(() => {
    const handleTokenJoin = async (token: string) => {
      try {
        const { data, error } = await supabase.rpc('validate_match_join_token', { p_token: token });
        if (error) throw error;
        if (!data || data.length === 0) {
          toast.error('Invalid or expired join link');
          return;
        }
        const tokenData = data[0];
        const params = new URLSearchParams(window.location.search);
        params.set('match', tokenData.match_id);
        params.set('team', tokenData.team_number.toString());
        if (tokenData.pin) params.set('pin', tokenData.pin);
        window.history.replaceState({}, '', `?${params.toString()}`);
        toast.success('Secure join link validated! Find the match below to join.');
        setTimeout(() => {
          document.getElementById('matches-section')?.scrollIntoView({ behavior: 'smooth' });
        }, 500);
      } catch (error: any) {
        toast.error(error.message || 'Failed to validate join link');
      }
    };

    const pathParts = window.location.pathname.split('/');
    if (pathParts[1] === 'join' && pathParts[2]) {
      handleTokenJoin(pathParts[2]);
      return;
    }

    const matchId = searchParams.get('match');
    const pin = searchParams.get('pin');
    if (matchId && pin && user) {
      toast.info('Match PIN detected in link. Find the match below to join.');
      setTimeout(() => {
        document.getElementById('matches-section')?.scrollIntoView({ behavior: 'smooth' });
      }, 500);
    }
  }, [searchParams, user]);

  const navItems = useMemo(() => {
    const items = [
      { value: "matches", label: "Find Matches", icon: <Search className="w-4 h-4" /> },
      { value: "past", label: "Past Matches", icon: <History className="w-4 h-4" /> },
      { value: "handicap", label: "Handicap", icon: <Trophy className="w-4 h-4" /> },
      { value: "subscription", label: "Subscription", icon: <Crown className="w-4 h-4" /> },
    ];
    if (hasActiveMatch) {
      items.unshift({ value: "active-match", label: "Active Match", icon: <Target className="w-4 h-4" /> });
    }
    return items;
  }, [hasActiveMatch]);

  const homeTabs: BottomTab[] = ["home", "past", "subscription"];
  const activeBottomTab: BottomTab = homeTabs.includes(currentTab as BottomTab)
    ? (currentTab as BottomTab)
    : "home";

  const handleReturnToMatch = () => {
    setCurrentTab("active-match");
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-muted/40 flex flex-col">
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <AppHeader
        showNavMenu
        onNavSelect={(v) => setCurrentTab(v)}
        currentTab={currentTab}
        navItems={navItems}
        onReturnToMatch={handleReturnToMatch}
        hideReturnButton={currentTab === "active-match"}
      />

      <main id="main-content" className="flex-1 pb-32 max-w-3xl w-full mx-auto px-4 md:px-6 pt-4" role="main">
        {currentTab === "active-match" && hasActiveMatch && (
          <Suspense fallback={<TabLoader />}>
            <MatchScorecard matchId={activeMatchId!} matchName={activeMatchName || "Active Match"} />
          </Suspense>
        )}

        {currentTab === "home" && (
          <div className="space-y-6">
            <div className="bg-card rounded-3xl p-4 shadow-card space-y-4">
              <HomeProfileCard />
              <HomeSearchBar value={searchQuery} onChange={setSearchQuery} />
            </div>
            <RecentlyPlayedCourses onSelect={(name) => setSearchQuery(name)} />
            <button
              type="button"
              onClick={() => navigate("/wins")}
              className="w-full flex items-center justify-between bg-card rounded-2xl p-4 shadow-card hover:shadow-elegant transition-all border border-border"
              aria-label="Open Wins Feed"
            >
              <span className="flex items-center gap-3">
                <span className="p-2 bg-gradient-primary rounded-lg">
                  <Trophy className="w-5 h-5 text-primary-foreground" />
                </span>
                <span className="text-left">
                  <span className="block font-semibold">Wins Feed</span>
                  <span className="block text-xs text-muted-foreground">See who's winning around the community</span>
                </span>
              </span>
              <ArrowUp className="w-4 h-4 rotate-45 text-muted-foreground" />
            </button>
          </div>
        )}

        {currentTab === "matches" && (
          <Suspense fallback={<TabLoader />}><MatchFinder hideHowItWorks /></Suspense>
        )}
        {currentTab === "past" && (
          <Suspense fallback={<TabLoader />}><MatchFinder hideHowItWorks showPastMatches /></Suspense>
        )}
        {currentTab === "handicap" && (
          <Suspense fallback={<TabLoader />}><HandicapSettings /></Suspense>
        )}
        {currentTab === "subscription" && (
          <Suspense fallback={<TabLoader />}><SubscriptionManagement /></Suspense>
        )}
      </main>

      <BottomTabBar activeTab={activeBottomTab} onChange={(tab) => setCurrentTab(tab)} />
      <HeroThemeSwitcher />
    </div>
  );
};

export default TycheDashboard;
