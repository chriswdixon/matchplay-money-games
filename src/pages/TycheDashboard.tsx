import GolfBallLoader from "@/components/GolfBallLoader";
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
import GamesNearYou from "@/components/home/GamesNearYou";
import RecentWins from "@/components/home/RecentWins";
import NearbyCoursesWithMatches from "@/components/NearbyCoursesWithMatches";


const MatchFinder = lazy(() => import("@/components/MatchFinder"));
const SubscriptionManagement = lazy(() => import("@/components/SubscriptionManagement"));
const HandicapCalculatorsInline = lazy(() => import("@/components/home/HandicapCalculatorsInline").then(m => ({ default: m.HandicapCalculatorsInline })));
const MatchScorecard = lazy(() => import("@/components/MatchScorecard").then(m => ({ default: m.MatchScorecard })));

const TabLoader = () => (
  <div className="flex items-center justify-center py-12">
    <GolfBallLoader />
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
      { value: "past", label: "Past Matches", icon: <Trophy className="w-4 h-4" /> },
      { value: "handicap", label: "Handicap", icon: <Trophy className="w-4 h-4" /> },
    ];
    if (hasActiveMatch) {
      items.unshift({ value: "active-match", label: "Active Match", icon: <Target className="w-4 h-4" /> });
    }
    return items;
  }, [hasActiveMatch]);

  const allTabs: BottomTab[] = ["home", "matches", "active-match", "past", "handicap"];
  const activeBottomTab: BottomTab = allTabs.includes(currentTab as BottomTab)
    ? (currentTab as BottomTab)
    : "home";

  const handleReturnToMatch = () => {
    setCurrentTab("active-match");
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-muted/40 flex flex-col">
      <a href="#main-content" className="skip-link">Skip to main content</a>

      <main id="main-content" className="flex-1 pb-32 md:pb-8 md:pt-24 max-w-3xl w-full mx-auto px-4 md:px-6 pt-6" role="main">
        {currentTab === "active-match" && hasActiveMatch && (
          <Suspense fallback={<TabLoader />}>
            <MatchScorecard matchId={activeMatchId!} matchName={activeMatchName || "Active Match"} />
          </Suspense>
        )}

        {currentTab === "home" && (
          <div className="space-y-6">
            <div className="bg-card rounded-3xl p-4 shadow-card">
              <HomeProfileCard />
            </div>
            <RecentlyPlayedCourses onSelect={(name) => setSearchQuery(name)} />
            <div className="bg-card rounded-3xl p-4 shadow-card">
              <NearbyCoursesWithMatches />
            </div>
            <RecentWins />
          </div>
        )}

        {currentTab === "matches" && (
          <div className="bg-card rounded-3xl p-4 shadow-card">
            <h2 className="text-2xl font-bold mb-4">Find Matches & Courses</h2>
            <NearbyCoursesWithMatches />
          </div>
        )}
        {currentTab === "past" && (
          <div className="bg-card rounded-3xl p-4 shadow-card">
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2"><Trophy className="w-6 h-6 text-primary" aria-hidden="true" />Past Matches</h2>
            <Suspense fallback={<TabLoader />}><MatchFinder hideHowItWorks showPastMatches /></Suspense>
          </div>
        )}
        {currentTab === "handicap" && (
          <Suspense fallback={<TabLoader />}><HandicapSettings /></Suspense>
        )}
      </main>

      <BottomTabBar activeTab={activeBottomTab} onChange={(tab) => setCurrentTab(tab)} hasActiveMatch={hasActiveMatch} />
      
    </div>
  );
};

export default TycheDashboard;
