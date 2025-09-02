import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { MapPin, Clock, Users, DollarSign, Trophy, Zap } from "lucide-react";
import { useMatches } from "@/hooks/useMatches";
import { useAuth } from "@/hooks/useAuth";
import CreateMatchDialog from "./CreateMatchDialog";
import { format } from "date-fns";

const MatchFinder = () => {
  const { matches, loading, joinMatch, leaveMatch } = useMatches();
  const { user } = useAuth();

  const formatMatchTime = (scheduledTime: string) => {
    const date = new Date(scheduledTime);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const matchDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

    if (matchDate.getTime() === today.getTime()) {
      return `Today ${format(date, 'h:mm a')}`;
    } else if (matchDate.getTime() === tomorrow.getTime()) {
      return `Tomorrow ${format(date, 'h:mm a')}`;
    } else {
      return format(date, 'EEE h:mm a');
    }
  };

  const formatBuyIn = (buyInCents: number) => {
    return `$${(buyInCents / 100).toFixed(0)}`;
  };

  const formatHandicapRange = (min?: number, max?: number) => {
    if (!min && !max) return 'Any HCP';
    if (min && max) return `${min}-${max} HCP`;
    if (min) return `${min}+ HCP`;
    if (max) return `0-${max} HCP`;
    return 'Any HCP';
  };

  const formatMatchFormat = (format: string) => {
    const formatMap: { [key: string]: string } = {
      'stroke-play': 'Stroke Play',
      'match-play': 'Match Play',
      'best-ball': '2v2 Best Ball',
      'skins': 'Skins Game',
      'scramble': 'Scramble'
    };
    return formatMap[format] || format;
  };

  const handleMatchAction = async (match: any) => {
    if (!user) return;
    
    if (match.user_joined) {
      await leaveMatch(match.id);
    } else {
      await joinMatch(match.id);
    }
  };

  const isMatchFull = (match: any) => {
    return (match.participant_count || 0) >= match.max_participants;
  };

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
          <div className="mt-8">
            <CreateMatchDialog />
          </div>
        </div>

        {/* Live Matches */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-12">
          {loading ? (
            // Loading skeletons
            Array.from({ length: 6 }, (_, index) => (
              <Card key={index} className="bg-card">
                <CardHeader className="pb-4">
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-4 w-full" />
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-full" />
                  </div>
                  <Skeleton className="h-6 w-20" />
                  <Skeleton className="h-10 w-full" />
                </CardContent>
              </Card>
            ))
          ) : matches.length === 0 ? (
            <div className="col-span-full text-center py-12">
              <p className="text-muted-foreground text-lg">No matches found. Be the first to create one!</p>
            </div>
          ) : (
            matches.map((match, index) => {
              const isFull = isMatchFull(match);
              const isCreatedRecently = new Date(match.created_at) > new Date(Date.now() - 5 * 60 * 1000); // Within 5 minutes
              
              return (
                <Card 
                  key={match.id} 
                  className="relative border-border hover:border-primary/30 transition-all duration-300 hover:shadow-card animate-slide-up bg-card"
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  {isCreatedRecently && (
                    <Badge className="absolute -top-2 -right-2 bg-success text-success-foreground animate-pulse">
                      <Zap className="w-3 h-3 mr-1" />
                      NEW
                    </Badge>
                  )}
                  
                  <CardHeader className="pb-4">
                    <CardTitle className="text-lg font-semibold text-foreground line-clamp-1">
                      {match.course_name}
                    </CardTitle>
                    <CardDescription className="flex items-center gap-2">
                      <MapPin className="w-4 h-4" />
                      {match.location}
                    </CardDescription>
                  </CardHeader>
                  
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-muted-foreground" />
                        <span className="text-foreground">{formatMatchTime(match.scheduled_time)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-muted-foreground" />
                        <span className="text-foreground">{match.participant_count || 0}/{match.max_participants} filled</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <DollarSign className="w-4 h-4 text-muted-foreground" />
                        <span className="text-foreground">{formatBuyIn(match.buy_in_amount)} buy-in</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Trophy className="w-4 h-4 text-muted-foreground" />
                        <span className="text-foreground">{formatHandicapRange(match.handicap_min, match.handicap_max)}</span>
                      </div>
                    </div>
                    
                    <div className="pt-2">
                      <Badge variant="outline" className="text-xs">
                        {formatMatchFormat(match.format)}
                      </Badge>
                    </div>
                    
                    <Button 
                      className="w-full bg-gradient-primary text-primary-foreground hover:shadow-premium transition-all duration-300"
                      disabled={isFull || !user}
                      onClick={() => handleMatchAction(match)}
                    >
                      {!user ? "Sign In to Join" : 
                       isFull ? "Match Full" : 
                       match.user_joined ? "Leave Match" : 
                       "Join Match"}
                    </Button>
                  </CardContent>
                </Card>
              );
            })
          )}
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