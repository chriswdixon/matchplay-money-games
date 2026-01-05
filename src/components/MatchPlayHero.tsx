import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MapPin, Users, DollarSign, Trophy, ChevronDown } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { UserMenu } from "@/components/auth/UserMenu";
import heroImage from "@/assets/hero-golf-course.jpg";

const MatchPlayHero = () => {
  const { user } = useAuth();

  const handleScrollDown = () => {
    const nextSection = document.querySelector('section:nth-of-type(2)');
    if (nextSection) {
      nextSection.scrollIntoView({ behavior: 'smooth' });
    }
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
        <img 
          src={heroImage} 
          alt="Premium golf course at sunset"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/50 to-black/30" />
      </div>
      
      {/* Content */}
      <div className="relative z-10 max-w-4xl mx-auto px-6 text-center text-white animate-fade-in">
        <Badge className="mb-6 bg-gradient-accent text-accent-foreground shadow-accent border-0 text-sm font-medium px-4 py-2">
          🏌️ Revolutionary Golf Experience
        </Badge>
        
        <h1 id="hero-heading" className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold mb-4 sm:mb-6 leading-tight">
          Welcome to{" "}
          <span className="bg-gradient-to-r from-accent via-accent-glow to-accent bg-clip-text text-transparent">
            MatchPlay
          </span>
        </h1>
        
        <p className="text-lg sm:text-xl md:text-2xl mb-6 sm:mb-8 text-gray-200 max-w-3xl mx-auto leading-relaxed">
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
                <Link to="/auth">Join MatchPlay</Link>
              </Button>
              <Button 
                variant="outline" 
                size="lg"
                className="border-white/30 bg-white/10 text-white hover:bg-white/20 backdrop-blur-sm w-full sm:w-auto px-6 sm:px-8 py-3 sm:py-4 text-base sm:text-lg font-medium transition-smooth"
                asChild
              >
                <Link to="/auth">Sign In</Link>
              </Button>
            </>
          )}
        </div>
        
        {/* Trust Indicators */}
        <aside className="mt-8 sm:mt-12 pt-6 sm:pt-8 border-t border-white/20" aria-label="Platform statistics">
          <p className="text-xs sm:text-sm text-gray-300 mb-3 sm:mb-4">Trusted by competitive golfers nationwide</p>
          <dl className="flex justify-center items-center gap-4 sm:gap-6 md:gap-8 text-accent/80">
            <div className="text-center">
              <dt className="sr-only">Active Members</dt>
              <dd className="text-xl sm:text-2xl font-bold">1,000+</dd>
              <dt className="text-xs">Active Members</dt>
            </div>
            <div className="text-center">
              <dt className="sr-only">Matches Played Value</dt>
              <dd className="text-xl sm:text-2xl font-bold">$500K+</dd>
              <dt className="text-xs">Matches Played</dt>
            </div>
            <div className="text-center">
              <dt className="sr-only">Rounds Scored</dt>
              <dd className="text-xl sm:text-2xl font-bold">5,000+</dd>
              <dt className="text-xs">Rounds Scored</dt>
            </div>
          </dl>
        </aside>
      </div>

      {/* Scroll Down Arrow */}
      <button
        onClick={handleScrollDown}
        className="absolute bottom-6 sm:bottom-8 left-1/2 transform -translate-x-1/2 z-10 text-white/80 hover:text-white transition-colors duration-300 animate-bounce-10 cursor-pointer group flex flex-col items-center"
        aria-label="Scroll down to see more"
      >
        <span className="text-xs sm:text-sm font-medium group-hover:text-accent transition-colors text-center">
          Scroll Down
        </span>
        <ChevronDown className="w-5 h-5 sm:w-6 sm:h-6 mt-1 sm:mt-2" />
      </button>
    </section>
  );
};

export default MatchPlayHero;