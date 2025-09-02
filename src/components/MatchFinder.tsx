import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Clock, Users, DollarSign, Trophy, Zap } from "lucide-react";

const MatchFinder = () => {
  const sampleMatches = [
    {
      id: 1,
      course: "Pebble Beach Golf Links",
      location: "Monterey, CA",
      time: "Today 3:00 PM",
      format: "2v2 Best Ball",
      buyIn: "$50",
      handicapRange: "5-15",
      spots: "2/4",
      distance: "0.8 miles",
      isLive: true
    },
    {
      id: 2,
      course: "Augusta National",
      location: "Augusta, GA", 
      time: "Tomorrow 10:00 AM",
      format: "Stroke Play",
      buyIn: "$100",
      handicapRange: "0-10",
      spots: "1/4",
      distance: "2.3 miles",
      isLive: false
    },
    {
      id: 3,
      course: "TPC Sawgrass",
      location: "Ponte Vedra Beach, FL",
      time: "Saturday 7:30 AM",
      format: "Skins Game",
      buyIn: "$75",
      handicapRange: "8-20",
      spots: "3/4",
      distance: "1.2 miles",
      isLive: false
    }
  ];

  return (
    <section className="py-20 px-6 bg-background">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16 animate-fade-in">
          <Badge className="mb-4 bg-success/10 text-success border-success/20">
            🎯 Live Match Finder
          </Badge>
          <h2 className="text-4xl md:text-5xl font-bold mb-6 text-foreground">
            Find Your Perfect Match
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            No more playing alone. Connect with golfers in your area, book money matches, 
            and compete with confidence knowing every stroke counts.
          </p>
        </div>

        {/* Live Matches */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-12">
          {sampleMatches.map((match, index) => (
            <Card 
              key={match.id} 
              className="relative border-border hover:border-primary/30 transition-all duration-300 hover:shadow-card animate-slide-up bg-card"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              {match.isLive && (
                <Badge className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground animate-pulse">
                  <Zap className="w-3 h-3 mr-1" />
                  LIVE
                </Badge>
              )}
              
              <CardHeader className="pb-4">
                <CardTitle className="text-lg font-semibold text-foreground line-clamp-1">
                  {match.course}
                </CardTitle>
                <CardDescription className="flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  {match.location} • {match.distance}
                </CardDescription>
              </CardHeader>
              
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    <span className="text-foreground">{match.time}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-muted-foreground" />
                    <span className="text-foreground">{match.spots} filled</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-muted-foreground" />
                    <span className="text-foreground">{match.buyIn} buy-in</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Trophy className="w-4 h-4 text-muted-foreground" />
                    <span className="text-foreground">{match.handicapRange} HCP</span>
                  </div>
                </div>
                
                <div className="pt-2">
                  <Badge variant="outline" className="text-xs">
                    {match.format}
                  </Badge>
                </div>
                
                <Button 
                  className="w-full bg-gradient-primary text-primary-foreground hover:shadow-premium transition-all duration-300"
                  disabled={match.spots === "0/4"}
                >
                  {match.spots === "0/4" ? "Match Full" : "Join Match"}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
        
        {/* How It Works */}
        <div className="bg-gradient-card rounded-2xl p-8 md:p-12">
          <h3 className="text-3xl font-bold text-center mb-8 text-foreground">How It Works</h3>
          <div className="grid md:grid-cols-4 gap-6">
            {[
              {
                step: "1",
                title: "Find Match",
                description: "Browse nearby matches or create your own based on location and skill level"
              },
              {
                step: "2", 
                title: "Secure Buy-In",
                description: "Deposit your match buy-in securely through our platform"
              },
              {
                step: "3",
                title: "Play & Score",
                description: "Use our live scoring system - no cheating, every stroke tracked"
              },
              {
                step: "4",
                title: "Get Paid",
                description: "Winners receive instant payout as soon as the round is complete"
              }
            ].map((step, index) => (
              <div key={step.step} className="text-center animate-fade-in" style={{ animationDelay: `${index * 0.2}s` }}>
                <div className="w-12 h-12 bg-gradient-primary text-primary-foreground rounded-full flex items-center justify-center font-bold text-lg mx-auto mb-4">
                  {step.step}
                </div>
                <h4 className="font-semibold mb-2 text-foreground">{step.title}</h4>
                <p className="text-sm text-muted-foreground">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default MatchFinder;