import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MapPin, Users, DollarSign, Trophy, ChevronDown } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { UserMenu } from "@/components/auth/UserMenu";
import heroVideo from "@/assets/hero-golf-ball.mp4.asset.json";
import heroImage from "@/assets/hero-golf-course.jpg?format=webp&quality=55&w=1280";

const TycheHero = () => {
  const { user } = useAuth();

  const handleScrollDown = () => {
    const target =
      document.getElementById("matches-section") ||
      (document.querySelector("main") as HTMLElement | null);
    if (!target) {
      window.scrollTo({ top: window.innerHeight, behavior: "smooth" });
      return;
    }
    const top = target.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({ top, behavior: "smooth" });
  };
  
  return (
    <section 
      className="relative min-h-screen flex items-center justify-center overflow-hidden"
      aria-labelledby="hero-heading"
    >
      {/* Navigation */}
      {user && (
        <nav className="absolute top-6 right-6 z-20" aria-label="User navigation">
          <UserMenu />
        </nav>
      )}
      
      {/* Hero Background */}
      <div className="absolute inset-0 z-0">
        <video
          src={heroVideo.url}
          poster={heroImage}
          autoPlay
          muted
          playsInline
          preload="auto"
          aria-label="Golf ball bouncing and rolling on a lush green golf course"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-black/55" />
      </div>
      
      {/* Content */}
      <div className="relative z-10 max-w-4xl mx-auto px-6 text-center text-white">
        <Badge className="mb-6 bg-gradient-accent text-accent-foreground shadow-accent border-0 text-sm font-medium px-4 py-2">
          🏌️ Revolutionary Golf Experience
        </Badge>
        
        <h1 id="hero-heading" className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold mb-4 sm:mb-6 leading-tight">
          <span className="text-white">
            Welcome to
          </span>{" "}
          <span className="bg-gradient-to-r from-primary via-primary-glow to-primary bg-clip-text text-transparent">
            Tyche
          </span>
        </h1>
        
        <p className="text-lg sm:text-xl md:text-2xl mb-6 sm:mb-8 text-gray-100 max-w-3xl mx-auto leading-relaxed">
          The ultimate platform for competitive golfers. Join skill-based competitions, track real handicaps, 
          and receive instant prize distribution. No more waiting, no more disputes.
        </p>
        
        {/* Feature Icons */}
        <ul className="flex flex-wrap justify-center gap-4 sm:gap-6 md:gap-8 mb-8 sm:mb-10 list-none" aria-label="Key features">
          <li className="flex items-center gap-2 text-accent text-sm sm:text-base">
            <MapPin className="w-5 h-5 sm:w-6 sm:h-6" aria-hidden="true" />
            <span className="font-medium">GPS Matching</span>
          </li>
          <li className="flex items-center gap-2 text-accent text-sm sm:text-base">
            <Users className="w-5 h-5 sm:w-6 sm:h-6" aria-hidden="true" />
            <span className="font-medium">Live Scoring</span>
          </li>
          <li className="flex items-center gap-2 text-accent text-sm sm:text-base">
            <DollarSign className="w-5 h-5 sm:w-6 sm:h-6" aria-hidden="true" />
            <span className="font-medium">Instant Prizes</span>
          </li>
          <li className="flex items-center gap-2 text-accent text-sm sm:text-base">
            <Trophy className="w-5 h-5 sm:w-6 sm:h-6" aria-hidden="true" />
            <span className="font-medium">Tournaments</span>
          </li>
        </ul>
        
        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center items-center">
          {user ? (
            <>
              <Button 
                size="lg" 
                className="bg-gradient-primary text-primary-foreground shadow-premium hover:shadow-accent transition-all duration-300 transform hover:scale-105 w-full sm:w-auto px-6 sm:px-8 py-3 sm:py-4 text-base sm:text-lg font-semibold border-0"
                onClick={handleScrollDown}
              >
                Find Matches
              </Button>
              <Button 
                variant="outline" 
                size="lg"
                className="border-white/30 bg-white/10 text-white hover:bg-white/20 backdrop-blur-sm w-full sm:w-auto px-6 sm:px-8 py-3 sm:py-4 text-base sm:text-lg font-medium transition-smooth"
                onClick={() => window.location.href = '/profile'}
              >
                View Profile
              </Button>
            </>
          ) : (
            <>
              <Button 
                size="lg" 
                className="bg-gradient-primary text-primary-foreground shadow-premium hover:shadow-accent transition-all duration-300 transform hover:scale-105 w-full sm:w-auto px-6 sm:px-8 py-3 sm:py-4 text-base sm:text-lg font-semibold border-0"
                asChild
              >
                <Link to="/auth?tab=signup">Join Tyche</Link>
              </Button>
              <Button 
                size="lg"
                className="bg-white text-primary hover:bg-white/90 shadow-premium w-full sm:w-auto px-6 sm:px-8 py-3 sm:py-4 text-base sm:text-lg font-semibold border-0 transition-smooth"
                asChild
              >
                <Link to="/auth">Sign In</Link>
              </Button>
            </>
          )}
        </div>
        
      </div>

      {/* Scroll Down Indicator */}
      <div className="absolute inset-x-0 bottom-6 sm:bottom-8 z-10 flex justify-center pointer-events-none">
        <button
          type="button"
          onClick={handleScrollDown}
          aria-label="Scroll down to see more"
          className="pointer-events-auto group flex flex-col items-center gap-1 px-4 py-2 rounded-full bg-black/30 backdrop-blur-sm text-white/90 hover:text-white hover:bg-black/40 focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none transition-colors"
        >
          <span className="text-xs sm:text-sm font-medium">Scroll Down</span>
          <ChevronDown className="w-5 h-5 sm:w-6 sm:h-6 animate-bounce-10" aria-hidden="true" />
        </button>
      </div>
    </section>
  );
};

export default TycheHero;