import GolfBallLoader from "@/components/GolfBallLoader";
import { lazy, Suspense, useEffect, useState } from "react";
import { Search, Trophy, Target, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useActiveMatch } from "@/hooks/useActiveMatch";
import { useSearchParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import HomeProfileCard from "@/components/home/HomeProfileCard";
import RecentlyPlayedCourses from "@/components/home/RecentlyPlayedCourses";
import BottomTabBar, { type BottomTab } from "@/components/home/BottomTabBar";
import RecentWins from "@/components/home/RecentWins";
import MyCurrentMatches from "@/components/home/MyCurrentMatches";
import MyPastMatches from "@/components/home/MyPastMatches";
import OpenMatches from "@/components/home/OpenMatches";
import NearbyCoursesWithMatches from "@/components/NearbyCoursesWithMatches";


const MatchFinder = lazy(() => import("@/components/MatchFinder"));
const HandicapCalculatorsInline = lazy(() => import("@/components/home/HandicapCalculatorsInline").then(m => ({ default: m.HandicapCalculatorsInline })));
const MatchScorecard = lazy(() => import("@/components/MatchScorecard").then(m => ({ default: m.MatchScorecard })));

const TabLoader = () => (
  <div className="flex items-center justify-center py-12">
    <GolfBallLoader showBrand />
  </div>
);

const TycheDashboard = () => {
  const { user } = useAuth();
  const { hasActiveMatch, activeMatchId, activeMatchName } = useActiveMatch();
  const [searchParams, setSearchParams] = useSearchParams();
  const [currentTab, setCurrentTab] = useState(() => searchParams.get('tab') || 'home');
  const navigate = useNavigate();

  // Sync ?tab= query param into currentTab when it changes (e.g. navigated from Profile/Wallet)
  useEffect(() => {
    const t = searchParams.get('tab');
    if (t && t !== currentTab) setCurrentTab(t);
  }, [searchParams]);


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

  const allTabs: BottomTab[] = ["home", "matches", "active-match", "past", "handicap"];
  const activeBottomTab: BottomTab = allTabs.includes(currentTab as BottomTab)
    ? (currentTab as BottomTab)
    : "home";

  return (
    <div className="app-page-bg flex flex-col">
      <a href="#main-content" className="skip-link">Skip to main content</a>

      <main id="main-content" className="flex-1 pb-32 md:pb-8 md:pt-24 max-w-3xl w-full mx-auto px-4 md:px-6 pt-6" role="main">
        {currentTab === "active-match" && hasActiveMatch && (
          <Suspense fallback={<TabLoader />}>
            <MatchScorecard matchId={activeMatchId!} matchName={activeMatchName || "Active Match"} />
          </Suspense>
        )}

        {currentTab === "home" && (
          <div className="space-y-6">
            <div className="page-card-shell">
              <HomeProfileCard />
            </div>

            {/* Primary CTA — Create Match takes the lead; Find/Open matches lives in its own card below */}
            <Button
              size="lg"
              onClick={() => setCurrentTab('matches')}
              className="w-full h-14 bg-gradient-primary text-primary-foreground font-semibold animate-glow-pulse shadow-[0_0_20px_hsl(var(--primary)/0.55),0_0_40px_hsl(var(--primary)/0.3)] hover:shadow-[0_0_28px_hsl(var(--primary)/0.7),0_0_56px_hsl(var(--primary)/0.4)]"
            >
              <Plus className="w-5 h-5 mr-1" aria-hidden="true" />
              Create Match
            </Button>

            <MyCurrentMatches />
            <OpenMatches />
            <RecentlyPlayedCourses onSelect={() => setCurrentTab('matches')} />
            <RecentWins />
          </div>
        )}

        {currentTab === "matches" && (
          <div className="page-card-shell">
            <h2 className="text-2xl font-bold mb-4">Find Matches & Courses</h2>
            <NearbyCoursesWithMatches />
          </div>
        )}
        {currentTab === "past" && (
          <div className="space-y-6">
            <MyCurrentMatches />
            <MyPastMatches />
          </div>
        )}
        {currentTab === "handicap" && (
          <Suspense fallback={<TabLoader />}><HandicapCalculatorsInline /></Suspense>
        )}
      </main>

      <BottomTabBar activeTab={activeBottomTab} onChange={(tab) => setCurrentTab(tab)} hasActiveMatch={hasActiveMatch} />
      
    </div>
  );
};

export default TycheDashboard;
