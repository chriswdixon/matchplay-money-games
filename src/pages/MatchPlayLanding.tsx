import MatchPlayHero from "@/components/MatchPlayHero";
import MatchFinder from "@/components/MatchFinder";
import AppFeatures from "@/components/AppFeatures";
import MembershipTiers from "@/components/MembershipTiers";
import { HandicapCalculators } from "@/components/HandicapCalculators";
import AppHeader from "@/components/AppHeader";
import AppFooter from "@/components/AppFooter";
import SubscriptionManagement from "@/components/SubscriptionManagement";
import { HandicapSettings } from "@/components/profile/HandicapSettings";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Crown, ArrowUp, History, Trophy } from "lucide-react";
import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useMatches } from "@/hooks/useMatches";

const MatchPlayLanding = () => {
  const { user } = useAuth();
  const { matches } = useMatches();
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [currentTab, setCurrentTab] = useState("matches");

  // Navigation items for hamburger menu
  const navItems = [
    { value: "matches", label: "Find Matches", icon: <Search className="w-4 h-4" /> },
    { value: "past", label: "Past Matches", icon: <History className="w-4 h-4" /> },
    { value: "handicap", label: "Handicap", icon: <Trophy className="w-4 h-4" /> },
    { value: "subscription", label: "Subscription", icon: <Crown className="w-4 h-4" /> },
  ];

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

  // Logged-in user experience
  if (user) {
    // If user has an active match, show only the scorecard (no tabs)
    if (activeMatch) {
      return (
        <div className="min-h-screen bg-background flex flex-col">
          <AppHeader />
          <main className="w-full flex-1">
            <MatchFinder hideHowItWorks />
          </main>
          <AppFooter />
        </div>
      );
    }

    // Otherwise show the tabs navigation
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <AppHeader 
          showNavMenu 
          onNavSelect={setCurrentTab}
          currentTab={currentTab}
          navItems={navItems}
        />
        <main className="container py-0 md:py-8 flex-1">
          <Tabs value={currentTab} onValueChange={setCurrentTab} className="w-full">
            {/* Desktop Tabs - Hidden on mobile */}
            <TabsList className="hidden md:grid w-full grid-cols-4 max-w-3xl mx-auto mb-8">
              <TabsTrigger value="matches" className="flex items-center gap-2">
                <Search className="w-4 h-4" />
                Find Matches
              </TabsTrigger>
              <TabsTrigger value="past" className="flex items-center gap-2">
                <History className="w-4 h-4" />
                Past Matches
              </TabsTrigger>
              <TabsTrigger value="handicap" className="flex items-center gap-2">
                <Trophy className="w-4 h-4" />
                Handicap
              </TabsTrigger>
              <TabsTrigger value="subscription" className="flex items-center gap-2">
                <Crown className="w-4 h-4" />
                Subscription
              </TabsTrigger>
            </TabsList>
            
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
      {/* Hero Section */}
      <MatchPlayHero />
      
      {/* Match Finder Section */}
      <MatchFinder />
      
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