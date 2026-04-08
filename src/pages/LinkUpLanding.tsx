import { lazy, Suspense, useEffect, useState, useMemo } from "react";
import MatchPlayHero from "@/components/MatchPlayHero";
import AppHeader from "@/components/AppHeader";
import AppFooter from "@/components/AppFooter";
import { InstallPrompt } from "@/components/InstallPrompt";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Crown, ArrowUp, History, Trophy, Target, Moon, Sun } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useActiveMatch } from "@/hooks/useActiveMatch";
import { useSearchParams } from "react-router-dom";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useTheme } from "@/components/ThemeProvider";
import heroImage from "@/assets/hero-golf-course.jpg?format=webp&quality=80";

// Lazy load components for better initial load performance
const MatchFinder = lazy(() => import("@/components/MatchFinder"));
const AppFeatures = lazy(() => import("@/components/AppFeatures"));
const MembershipTiers = lazy(() => import("@/components/MembershipTiers"));
const HandicapCalculators = lazy(() => import("@/components/HandicapCalculators").then(m => ({ default: m.HandicapCalculators })));
const SubscriptionManagement = lazy(() => import("@/components/SubscriptionManagement"));
const HandicapSettings = lazy(() => import("@/components/profile/HandicapSettings").then(m => ({ default: m.HandicapSettings })));
const MatchScorecard = lazy(() => import("@/components/MatchScorecard").then(m => ({ default: m.MatchScorecard })));

// Minimal loading fallback for lazy components
const TabLoader = () => (
  <div className="flex items-center justify-center py-12">
    <div className="animate-pulse text-muted-foreground">Loading...</div>
  </div>
);

const SectionLoader = () => (
  <div className="flex items-center justify-center py-16">
    <div className="animate-pulse text-muted-foreground">Loading...</div>
  </div>
);

const MatchPlayLanding = () => {
  const { user } = useAuth();
  const { hasActiveMatch, activeMatchId, activeMatchName, setActiveMatch } = useActiveMatch();
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [currentTab, setCurrentTab] = useState("matches");
  const [searchParams] = useSearchParams();
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

  // Navigation items for hamburger menu (dynamically includes active match)
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
    return (
      <div className="min-h-screen bg-background flex flex-col">
        {/* WCAG 2.1 AA - Skip to main content link */}
        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>
        <AppHeader 
          showNavMenu 
          onNavSelect={setCurrentTab}
          currentTab={currentTab}
          navItems={navItems}
          onReturnToMatch={handleReturnToMatch}
          hideReturnButton={currentTab === "active-match"}
        />
        <main id="main-content" className="container flex-1 py-8 relative" role="main">
          {/* Background for logged-in users in light mode */}
          {isLightMode && (
            <div className="fixed inset-0 z-0 pointer-events-none">
              <img 
                src={heroImage} 
                alt="Golf course background"
                className="w-full h-full object-cover opacity-45"
              />
              <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-background/70 to-background" />
            </div>
          )}
          
          <div className="relative z-10">
            <InstallPrompt />
            <Tabs value={currentTab} onValueChange={setCurrentTab} className="w-full">
              {/* Desktop/Tablet Tabs - Dynamically adjusts based on active match */}
              <TabsList className={cn(
                "hidden md:grid w-full max-w-[1400px] mx-auto mb-8",
                hasActiveMatch ? "grid-cols-5" : "grid-cols-4"
              )}>
                {hasActiveMatch && (
                  <TabsTrigger value="active-match" className="flex items-center gap-2">
                    <Target className="w-4 h-4" />
                    <span className="hidden lg:inline">Active Match</span>
                    <span className="lg:hidden">Active</span>
                  </TabsTrigger>
                )}
                <TabsTrigger value="matches" className="flex items-center gap-2">
                  <Search className="w-4 h-4" />
                  <span className="hidden lg:inline">Find Matches</span>
                  <span className="lg:hidden">Matches</span>
                </TabsTrigger>
                <TabsTrigger value="past" className="flex items-center gap-2">
                  <History className="w-4 h-4" />
                  <span className="hidden lg:inline">Past Matches</span>
                  <span className="lg:hidden">Past</span>
                </TabsTrigger>
                <TabsTrigger value="handicap" className="flex items-center gap-2">
                  <Trophy className="w-4 h-4" />
                  Handicap
                </TabsTrigger>
                <TabsTrigger value="subscription" className="flex items-center gap-2">
                  <Crown className="w-4 h-4" />
                  <span className="hidden lg:inline">Subscription</span>
                  <span className="lg:hidden">Sub</span>
                </TabsTrigger>
              </TabsList>
              
              {hasActiveMatch && (
                <TabsContent value="active-match">
                  <Suspense fallback={<TabLoader />}>
                    <MatchScorecard
                      matchId={activeMatchId!}
                      matchName={activeMatchName || 'Active Match'}
                    />
                  </Suspense>
                </TabsContent>
              )}
              
              <TabsContent value="matches">
                <Suspense fallback={<TabLoader />}>
                  <MatchFinder hideHowItWorks />
                </Suspense>
              </TabsContent>
              
              <TabsContent value="past">
                <Suspense fallback={<TabLoader />}>
                  <MatchFinder hideHowItWorks showPastMatches />
                </Suspense>
              </TabsContent>
              
              <TabsContent value="handicap">
                <Suspense fallback={<TabLoader />}>
                  <HandicapSettings />
                </Suspense>
              </TabsContent>
              
              <TabsContent value="subscription">
                <Suspense fallback={<TabLoader />}>
                  <SubscriptionManagement />
                </Suspense>
              </TabsContent>
            </Tabs>
          </div>
        </main>
        <AppFooter />
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
      {/* Dark Mode Toggle for Landing Page */}
      <header className="fixed top-0 left-0 right-0 z-50 p-4 flex justify-end" role="banner">
        <Button 
          variant="ghost" 
          size="icon" 
          className="bg-background/80 backdrop-blur-sm border border-border min-w-[44px] min-h-[44px] touch-manipulation relative"
          style={{ WebkitTapHighlightColor: 'transparent' }}
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
        >
          <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" aria-hidden="true" />
          <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" aria-hidden="true" />
        </Button>
      </header>
      
      {/* Hero Section */}
      <MatchPlayHero />
      
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
      
      {/* Handicap Calculators Section */}
      <Suspense fallback={<SectionLoader />}>
        <HandicapCalculators />
      </Suspense>
      
      {/* Membership Tiers Section */}
      <Suspense fallback={<SectionLoader />}>
        <MembershipTiers />
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
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12">
            <Button 
              size="lg"
              className="bg-accent text-accent-foreground hover:bg-accent-glow shadow-accent transition-all duration-300 px-8 py-4 text-lg font-semibold"
            >
              Get Early Access
            </Button>
            <Button 
              variant="outline" 
              size="lg"
              className="border-white/30 bg-white/10 text-white hover:bg-white/20 backdrop-blur-sm px-8 py-4 text-lg"
            >
              Schedule Demo
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

export default MatchPlayLanding;