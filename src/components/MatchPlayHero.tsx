import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MapPin, Users, DollarSign, Trophy } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { UserMenu } from "@/components/auth/UserMenu";
import heroImage from "@/assets/hero-golf-course.jpg";

const MatchPlayHero = () => {
  const { user } = useAuth();
  
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Navigation */}
      {user && (
        <div className="absolute top-6 right-6 z-20">
          <UserMenu />
        </div>
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
        
        <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight">
          Welcome to{" "}
          <span className="bg-gradient-to-r from-accent via-accent-glow to-accent bg-clip-text text-transparent">
            MatchPlay
          </span>
        </h1>
        
        <p className="text-xl md:text-2xl mb-8 text-gray-200 max-w-3xl mx-auto leading-relaxed">
          The ultimate platform for competitive golfers. Book money matches, track real handicaps, 
          and get paid instantly. No more waiting, no more disputes.
        </p>
        
        {/* Feature Icons */}
        <div className="flex justify-center gap-8 mb-10">
          <div className="flex items-center gap-2 text-accent">
            <MapPin className="w-6 h-6" />
            <span className="font-medium">GPS Matching</span>
          </div>
          <div className="flex items-center gap-2 text-accent">
            <Users className="w-6 h-6" />
            <span className="font-medium">Live Scoring</span>
          </div>
          <div className="flex items-center gap-2 text-accent">
            <DollarSign className="w-6 h-6" />
            <span className="font-medium">Instant Payout</span>
          </div>
          <div className="flex items-center gap-2 text-accent">
            <Trophy className="w-6 h-6" />
            <span className="font-medium">Tournaments</span>
          </div>
        </div>
        
        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          {user ? (
            <>
              <Button 
                size="lg" 
                className="bg-gradient-primary text-primary-foreground shadow-premium hover:shadow-accent transition-all duration-300 transform hover:scale-105 px-8 py-4 text-lg font-semibold border-0"
              >
                Find Matches
              </Button>
              <Button 
                variant="outline" 
                size="lg"
                className="border-white/30 bg-white/10 text-white hover:bg-white/20 backdrop-blur-sm px-8 py-4 text-lg font-medium transition-smooth"
                onClick={() => window.location.href = '/profile'}
              >
                View Profile
              </Button>
            </>
          ) : (
            <>
              <Button 
                size="lg" 
                className="bg-gradient-primary text-primary-foreground shadow-premium hover:shadow-accent transition-all duration-300 transform hover:scale-105 px-8 py-4 text-lg font-semibold border-0"
                asChild
              >
                <Link to="/auth">Join MatchPlay</Link>
              </Button>
              <Button 
                variant="outline" 
                size="lg"
                className="border-white/30 bg-white/10 text-white hover:bg-white/20 backdrop-blur-sm px-8 py-4 text-lg font-medium transition-smooth"
                asChild
              >
                <Link to="/auth">Sign In</Link>
              </Button>
            </>
          )}
        </div>
        
        {/* Trust Indicators */}
        <div className="mt-12 pt-8 border-t border-white/20">
          <p className="text-sm text-gray-300 mb-4">Trusted by competitive golfers nationwide</p>
          <div className="flex justify-center items-center gap-8 text-accent/80">
            <div className="text-center">
              <div className="text-2xl font-bold">1,000+</div>
              <div className="text-xs">Active Members</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">$500K+</div>
              <div className="text-xs">Matches Played</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">5,000+</div>
              <div className="text-xs">Rounds Scored</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default MatchPlayHero;