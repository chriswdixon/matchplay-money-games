import { lazy, Suspense, useEffect, useState } from "react";
import TycheHero from "@/components/TycheHero";
import AppFooter from "@/components/AppFooter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowUp, Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";

// Defer all below-the-fold sections — visitors only need the hero immediately.
const MatchFinder = lazy(() => import("@/components/MatchFinder"));
const AppFeatures = lazy(() => import("@/components/AppFeatures"));
const MembershipTiers = lazy(() => import("@/components/MembershipTiers"));
const HandicapCalculators = lazy(() =>
  import("@/components/HandicapCalculators").then(m => ({ default: m.HandicapCalculators }))
);


const SectionLoader = () => (
  <div className="flex items-center justify-center py-16">
    <div className="animate-pulse text-muted-foreground">Loading...</div>
  </div>
);

const TychePublicLanding = () => {
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [hydrateBelowFold, setHydrateBelowFold] = useState(false);
  const { theme, setTheme } = useTheme();

  // Defer below-the-fold work until the browser is idle so the hero/LCP
  // and main-thread budget aren't blocked at startup.
  useEffect(() => {
    const trigger = () => setHydrateBelowFold(true);
    const w = window as Window & { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number };
    if (typeof w.requestIdleCallback === "function") {
      w.requestIdleCallback(trigger, { timeout: 2000 });
    } else {
      const id = window.setTimeout(trigger, 1200);
      return () => window.clearTimeout(id);
    }
  }, []);

  useEffect(() => {
    let ticking = false;
    const handleScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        setShowScrollTop(window.scrollY > 400);
        if (!hydrateBelowFold && window.scrollY > 50) setHydrateBelowFold(true);
        ticking = false;
      });
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [hydrateBelowFold]);

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

  return (
    <div className="min-h-screen bg-background">
      <a href="#main-content" className="skip-link">Skip to main content</a>

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

      <TycheHero />

      <main id="main-content" role="main">
        <div id="matches-section">
          {hydrateBelowFold ? (
            <Suspense fallback={<SectionLoader />}>
              <MatchFinder />
            </Suspense>
          ) : (
            <SectionLoader />
          )}
        </div>
      </main>

      {hydrateBelowFold && (
        <>
          <Suspense fallback={<SectionLoader />}><AppFeatures /></Suspense>
          <Suspense fallback={<SectionLoader />}><HandicapCalculators /></Suspense>
          <Suspense fallback={<SectionLoader />}><MembershipTiers /></Suspense>
        </>
      )}

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
              size="lg"
              className="bg-accent text-accent-foreground hover:bg-accent-glow shadow-accent transition-all duration-300 px-8 py-4 text-lg font-semibold"
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

      <AppFooter />
    </div>
  );
};

export default TychePublicLanding;
