import GolfBallLoader from "@/components/GolfBallLoader";
import { lazy, Suspense, useEffect, useState, useMemo } from "react";
import TycheHero from "@/components/TycheHero";
import AppHeader from "@/components/AppHeader";
import AppFooter from "@/components/AppFooter";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Crown, ArrowUp, History, Trophy, Target } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useActiveMatch } from "@/hooks/useActiveMatch";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useTheme } from "@/components/ThemeProvider";
import heroImage from "@/assets/hero-golf-course.jpg?format=webp&quality=80";
import HomeProfileCard from "@/components/home/HomeProfileCard";
import HomeSearchBar from "@/components/home/HomeSearchBar";
import RecentlyPlayedCourses from "@/components/home/RecentlyPlayedCourses";
import GamesNearYou from "@/components/home/GamesNearYou";
import RecentWins from "@/components/home/RecentWins";
import NearbyCoursesWithMatches from "@/components/NearbyCoursesWithMatches";
import MyCurrentMatches from "@/components/home/MyCurrentMatches";

import BottomTabBar, { type BottomTab } from "@/components/home/BottomTabBar";


// Lazy load components for better initial load performance
const MatchFinder = lazy(() => import("@/components/MatchFinder"));
const AppFeatures = lazy(() => import("@/components/AppFeatures"));
const MembershipTiers = lazy(() => import("@/components/MembershipTiers"));
const HandicapCalculators = lazy(() => import("@/components/HandicapCalculators").then(m => ({ default: m.HandicapCalculators })));
const SubscriptionManagement = lazy(() => import("@/components/SubscriptionManagement"));

const MatchScorecard = lazy(() => import("@/components/MatchScorecard").then(m => ({ default: m.MatchScorecard })));

// Minimal loading fallback for lazy components
const TabLoader = () => (
  <div className="flex items-center justify-center py-12">
    <GolfBallLoader showBrand />
  </div>
);

const SectionLoader = () => (
  <div className="flex items-center justify-center py-16">
    <GolfBallLoader size={56} />
  </div>
);

const TycheLanding = () => {
  const { user } = useAuth();
  const { hasActiveMatch, activeMatchId, activeMatchName, setActiveMatch } = useActiveMatch();
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [currentTab, setCurrentTab] = useState("home");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();


  // Handle shared PIN links and secure token links
  useEffect(() => {
    const handleTokenJoin = async (token: string) => {
      try {
        const { data, error } = await supabase.rpc('validate_match_join_token', {
          p_token: token
        });

        if (error) throw error;

        if (!data || data.length === 0) {
          toast.error('Invalid or expired join link');
          return;
        }

        const tokenData = data[0];
        // Navigate with match, team, and extracted PIN
        const params = new URLSearchParams(window.location.search);
        params.set('match', tokenData.match_id);
        params.set('team', tokenData.team_number.toString());
        if (tokenData.pin) params.set('pin', tokenData.pin);
        
        window.history.replaceState({}, '', `?${params.toString()}`);
        toast.success('Secure join link validated! Find the match below to join.');
        
        setTimeout(() => {
          const element = document.getElementById('matches-section');
          if (element) {
            element.scrollIntoView({ behavior: 'smooth' });
          }
        }, 500);
      } catch (error: any) {
        toast.error(error.message || 'Failed to validate join link');
      }
    };

    // Check for secure token in URL path (e.g., /join/TOKEN)
    const pathParts = window.location.pathname.split('/');
    if (pathParts[1] === 'join' && pathParts[2]) {
      const token = pathParts[2];
      handleTokenJoin(token);
      return;
    }

    // Handle legacy PIN-based links
    const matchId = searchParams.get('match');
    const pin = searchParams.get('pin');

    if (matchId && pin && user) {
      toast.info('Match PIN detected in link. Find the match below to join.');
      setTimeout(() => {
        const element = document.getElementById('matches-section');
        if (element) {
          element.scrollIntoView({ behavior: 'smooth' });
        }
      }, 500);
    }
  }, [searchParams, user]);

  // Allow navigation from other pages via ?tab=...
  useEffect(() => {
    const t = searchParams.get('tab');
    if (t && ['home', 'matches', 'active-match', 'past'].includes(t)) {
      setCurrentTab(t);
    }
  }, [searchParams]);

  // Navigation items for hamburger menu (dynamically includes active match)
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

  const isLightMode = theme === "light";

  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 400);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleReturnToMatch = () => {
    setCurrentTab("active-match");
    scrollToTop();
  };

  // Logged-in user experience
  if (user) {
    // Map currentTab to the new bottom tab system
    const allTabs: BottomTab[] = ["home", "matches", "active-match", "past", "handicap"];
    const activeBottomTab: BottomTab = allTabs.includes(currentTab as BottomTab)
      ? (currentTab as BottomTab)
      : "home";

    return (
      <div className="app-page-bg flex flex-col min-h-screen">
        {/* WCAG 2.1 AA - Skip to main content link */}
        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>

        <AppHeader
          onReturnToMatch={hasActiveMatch ? handleReturnToMatch : undefined}
        />

        <main
          id="main-content"
          className="flex-1 pb-8 max-w-3xl w-full mx-auto px-4 md:px-6 pt-4 md:pt-6"
          role="main"
        >
          {/* Active match banner takes priority */}
          {currentTab === "active-match" && hasActiveMatch && (
            <Suspense fallback={<TabLoader />}>
              <div className="page-card-shell">
                <MatchScorecard
                  matchId={activeMatchId!}
                  matchName={activeMatchName || "Active Match"}
                />
              </div>
            </Suspense>
          )}

          {currentTab === "home" && (
            <div className="space-y-6">
              <div className="page-card-shell">
                <HomeProfileCard />
              </div>

              <RecentlyPlayedCourses onSelect={(name) => setSearchQuery(name)} />

              <div className="page-card-shell">
                <NearbyCoursesWithMatches />
              </div>

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
              <div className="page-card-shell">
                <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                  <Trophy className="w-6 h-6 text-primary" aria-hidden="true" />
                  Past Matches
                </h2>
                <Suspense fallback={<TabLoader />}>
                  <MatchFinder hideHowItWorks showPastMatches />
                </Suspense>
              </div>
            </div>
          )}
        </main>
      </div>
    );
  }

  // Landing page for non-logged-in users
  return (
    <div className="min-h-screen bg-background">
      {/* WCAG 2.1 AA - Skip to main content link */}
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      {/* Hero Section */}
      <TycheHero />
      
      {/* Match Finder Section */}
      <main id="main-content" role="main">
        <div id="matches-section">
          <Suspense fallback={<SectionLoader />}>
            <MatchFinder />
          </Suspense>
        </div>
      </main>
      
      {/* App Features Section */}
      <Suspense fallback={<SectionLoader />}>
        <AppFeatures />
      </Suspense>
      
      {/* Membership Tiers Section */}
      <div id="membership">
        <Suspense fallback={<SectionLoader />}>
          <MembershipTiers />
        </Suspense>
      </div>

      {/* Handicap Calculators Section */}
      <Suspense fallback={<SectionLoader />}>
        <HandicapCalculators />
      </Suspense>
      
      {/* Footer CTA */}
      <section className="py-20 px-6 bg-gradient-hero text-white" aria-labelledby="cta-heading">
        <div className="max-w-4xl mx-auto text-center">
          <Badge className="mb-6 bg-accent text-accent-foreground">
            Ready to Transform Your Golf Game?
          </Badge>
          <h2 id="cta-heading" className="text-4xl md:text-5xl font-bold mb-6">
            Join the Future of Competitive Golf
          </h2>
          <p className="text-xl mb-8 text-white/90 max-w-2xl mx-auto">
            Stop waiting for payouts. Stop dealing with disputes. 
            Start playing golf the way it was meant to be played - competitively and fairly.
          </p>
          
          <div className="flex justify-center items-center mb-12">
            <Button
              asChild
              size="lg"
              className="bg-accent text-accent-foreground hover:bg-accent-glow shadow-accent transition-all duration-300 px-8 py-4 text-lg font-semibold"
            >
              <Link to="/auth?tab=signup">Join Tyche</Link>
            </Button>
          </div>
          
          <div className="text-center text-sm text-white/70">
            <p className="mb-2"><span aria-hidden="true">🏌️</span> Currently piloting in select states</p>
            <p>Be among the first 1,000 members to shape the future of competitive golf</p>
          </div>
        </div>
      </section>
      
      {/* Scroll to Top Button */}
      {showScrollTop && (
        <Button
          onClick={scrollToTop}
          className="fixed bottom-6 right-6 w-12 h-12 rounded-full bg-gradient-primary text-primary-foreground shadow-premium hover:shadow-accent transition-all duration-300 z-50"
          size="icon"
          aria-label="Scroll to top of page"
        >
          <ArrowUp className="w-5 h-5" aria-hidden="true" />
        </Button>
      )}
      
      {/* Footer */}
      <AppFooter />
      
    </div>
  );
};

export default TycheLanding;