import MatchPlayHero from "@/components/MatchPlayHero";
import MatchFinder from "@/components/MatchFinder";
import AppFeatures from "@/components/AppFeatures";
import MembershipTiers from "@/components/MembershipTiers";
import { HandicapCalculators } from "@/components/HandicapCalculators";
import AppHeader from "@/components/AppHeader";
import AppFooter from "@/components/AppFooter";
import SubscriptionManagement from "@/components/SubscriptionManagement";
import { HandicapSettings } from "@/components/profile/HandicapSettings";
import { MatchScorecard } from "@/components/MatchScorecard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Crown, ArrowUp, History, Trophy, Target } from "lucide-react";
import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useMatches } from "@/hooks/useMatches";
import { useActiveMatch } from "@/hooks/useActiveMatch";
import { useSearchParams } from "react-router-dom";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const MatchPlayLanding = () => {
  const { user } = useAuth();
  const { matches } = useMatches();
  const { hasActiveMatch, activeMatchId, activeMatchName, setActiveMatch } = useActiveMatch();
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [currentTab, setCurrentTab] = useState("matches");
  const [searchParams] = useSearchParams();

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

  // Check if user has an active match
  const activeMatch = useMemo(() => {
    if (!user) return null;
    return matches.find(match => 
      match.status === 'started' && match.user_joined
    );
  }, [matches, user]);

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
        <AppHeader 
          showNavMenu 
          onNavSelect={setCurrentTab}
          currentTab={currentTab}
          navItems={navItems}
          onReturnToMatch={handleReturnToMatch}
          hideReturnButton={currentTab === "active-match"}
        />
        <main className="container flex-1 py-8">
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
                <MatchScorecard
                  matchId={activeMatchId!}
                  matchName={activeMatchName || 'Active Match'}
                />
              </TabsContent>
            )}
            
            <TabsContent value="matches">
              <MatchFinder hideHowItWorks />
            </TabsContent>
            
            <TabsContent value="past">
              <MatchFinder hideHowItWorks showPastMatches />
            </TabsContent>
            
            <TabsContent value="handicap">
              <HandicapSettings />
            </TabsContent>
            
            <TabsContent value="subscription">
              <SubscriptionManagement />
            </TabsContent>
          </Tabs>
        </main>
        <AppFooter />
      </div>
    );
  }

  // Landing page for non-logged-in users
  return (
    <div className="min-h-screen bg-background">
      <AppHeader onReturnToMatch={handleReturnToMatch} />
      
      {/* Hero Section */}
      <MatchPlayHero />
      
      {/* Match Finder Section */}
      <div id="matches-section">
        <MatchFinder />
      </div>
      
      {/* App Features Section */}
      <AppFeatures />
      
      {/* Handicap Calculators Section */}
      <HandicapCalculators />
      
      {/* Membership Tiers Section */}
      <MembershipTiers />
      
      {/* Footer CTA */}
      <section className="py-20 px-6 bg-gradient-hero text-white">
        <div className="max-w-4xl mx-auto text-center">
          <Badge className="mb-6 bg-accent text-accent-foreground">
            Ready to Transform Your Golf Game?
          </Badge>
          <h2 className="text-4xl md:text-5xl font-bold mb-6">
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
            <p className="mb-2">🏌️ Currently piloting in licensed gambling states</p>
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
        >
          <ArrowUp className="w-5 h-5" />
        </Button>
      )}
    </div>
  );
};

export default MatchPlayLanding;