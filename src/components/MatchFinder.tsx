import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { MapPin, Clock, Users, DollarSign, Trophy, Zap, Navigation, Star, Target, Calendar, Lock, AlertTriangle } from "lucide-react";
import { useMatches } from "@/hooks/useMatches";
import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "@/hooks/useLocation";
import { useFreeTier } from "@/hooks/useFreeTier";
import CreateMatchButton from "./CreateMatchButton";
import MatchFilters, { MatchFilters as FilterType } from "./MatchFilters";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import EditMatchDialog from "./EditMatchDialog";
import { cn } from "@/lib/utils";
import { useState, useEffect, useMemo, lazy, Suspense } from "react";

// Lazy load heavy dialog components - only loaded when user interacts
const PlayerRatingDialog = lazy(() => import("./PlayerRatingDialog"));
const MatchScorecard = lazy(() => import("./MatchScorecard").then(m => ({ default: m.MatchScorecard })));
const MatchResults = lazy(() => import("./MatchResults").then(m => ({ default: m.MatchResults })));
const PinEntryDialog = lazy(() => import("./PinEntryDialog").then(m => ({ default: m.PinEntryDialog })));
const TeamJoinDialog = lazy(() => import("./TeamJoinDialog").then(m => ({ default: m.TeamJoinDialog })));
const MatchPinManagement = lazy(() => import("./MatchPinManagement").then(m => ({ default: m.MatchPinManagement })));

const MatchFinder = ({ hideHowItWorks = false, showPastMatches = false }: { hideHowItWorks?: boolean; showPastMatches?: boolean }) => {
  const { matches, loading, joinMatch, leaveMatch, refetch } = useMatches();
  const { user } = useAuth();
  const { location, requestLocation, formatDistance } = useLocation();
  const { hasAccess } = useFreeTier();
  const [searchRadius, setSearchRadius] = useState(30);
  const [showFilters, setShowFilters] = useState(false);
  const [ratingDialogOpen, setRatingDialogOpen] = useState(false);
  const [selectedMatchForRating, setSelectedMatchForRating] = useState<any>(null);
  const [scorecardMatch, setScorecardMatch] = useState<any>(null);
  const [resultsMatch, setResultsMatch] = useState<any>(null);
  const [startingMatch, setStartingMatch] = useState<string | null>(null);
  const [filters, setFilters] = useState<FilterType>({
    search: '',
    format: 'all',
    maxDistance: 30,
    buyInRange: [0, 500] as [number, number],
    dateRange: 'all',
    spots: 'all'
  });
  const [pinDialogOpen, setPinDialogOpen] = useState(false);
  const [teamJoinDialogOpen, setTeamJoinDialogOpen] = useState(false);
  const [selectedMatchForPin, setSelectedMatchForPin] = useState<any>(null);
  const [expandedMatchId, setExpandedMatchId] = useState<string | null>(null);

  // Request location on component mount (only for current matches, not past, and only if user has access)
  useEffect(() => {
    if (user && !location && !showPastMatches && hasAccess('gps_matching')) {
      requestLocation();
    }
  }, [user, location, requestLocation, showPastMatches, hasAccess]);

  // Refetch matches when location changes (with debouncing)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (location) {
        refetch(location);
      } else {
        refetch();
      }
    }, 300); // Debounce location changes

    return () => clearTimeout(timer);
  }, [location, searchRadius]); // Removed refetch from dependencies to prevent loops

  // Separate incomplete matches (started matches >4 hours old that user joined)
  const incompleteMatches = useMemo(() => {
    if (showPastMatches || !user) return [];
    
    const now = new Date();
    const fourHoursAgo = new Date(now.getTime() - 4 * 60 * 60 * 1000);
    
    return matches.filter(match => 
      match.status === 'started' && 
      match.user_joined &&
      new Date(match.scheduled_time) < fourHoursAgo
    );
  }, [matches, showPastMatches, user]);

  // Filter matches based on current filters and view type
  const filteredMatches = useMemo(() => {
    let filtered = [...matches];
    const now = new Date();

    // Filter by view type (current vs past matches)
    if (showPastMatches) {
      // Show completed and cancelled matches
      filtered = filtered.filter(match => 
        match.status === 'completed' || match.status === 'cancelled'
      );
    } else {
      // Show only current/upcoming matches
      filtered = filtered.filter(match => {
        // Exclude completed matches
        if (match.status === 'completed') return false;
        
        // Exclude cancelled matches
        if (match.status === 'cancelled') return false;
        
        // Exclude started matches (will show separately in incomplete section if needed)
        if (match.status === 'started') return false;
        
        // Exclude open matches that are scheduled in the past
        if (match.status === 'open' && new Date(match.scheduled_time) < now) {
          return false;
        }
        
        return true;
      });
    }

    // Search filter
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(match => 
        match.course_name.toLowerCase().includes(searchLower) ||
        match.location.toLowerCase().includes(searchLower) ||
        match.address?.toLowerCase().includes(searchLower)
      );
    }

    // Format filter
    if (filters.format !== 'all') {
      filtered = filtered.filter(match => match.format === filters.format);
    }

    // Distance filter
    if (filters.maxDistance !== 30) {
      filtered = filtered.filter(match => 
        !match.distance_km || match.distance_km <= filters.maxDistance
      );
    }

    // Buy-in filter
    const [minBuyIn, maxBuyIn] = filters.buyInRange;
    filtered = filtered.filter(match => {
      const buyInDollars = match.buy_in_amount / 100;
      return buyInDollars >= minBuyIn && buyInDollars <= maxBuyIn;
    });

    // Date filter (only for current matches, not past)
    if (!showPastMatches && filters.dateRange !== 'all') {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const weekEnd = new Date(today);
      weekEnd.setDate(weekEnd.getDate() + 7);

      filtered = filtered.filter(match => {
        const matchDate = new Date(match.scheduled_time);
        const matchDay = new Date(matchDate.getFullYear(), matchDate.getMonth(), matchDate.getDate());

        switch (filters.dateRange) {
          case 'today':
            return matchDay.getTime() === today.getTime();
          case 'tomorrow':
            return matchDay.getTime() === tomorrow.getTime();
          case 'week':
            return matchDate >= today && matchDate <= weekEnd;
          case 'weekend':
            const dayOfWeek = matchDay.getDay();
            return (dayOfWeek === 0 || dayOfWeek === 6) && matchDate >= today;
          default:
            return true;
        }
      });
    }

    // Spots filter (only for current matches, not past)
    if (!showPastMatches && filters.spots !== 'all') {
      filtered = filtered.filter(match => {
        const availableSpots = match.max_participants - (match.participant_count || 0);
        switch (filters.spots) {
          case '1':
            return availableSpots >= 1;
          case '2+':
            return availableSpots >= 2;
          case '3+':
            return availableSpots >= 3;
          default:
            return true;
        }
      });
    }

    // Sort by scheduled_time - descending (newest first) for past matches
    if (showPastMatches) {
      filtered.sort((a, b) => 
        new Date(b.scheduled_time).getTime() - new Date(a.scheduled_time).getTime()
      );
    }

    return filtered;
  }, [matches, filters, showPastMatches]);

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
      'best-ball': 'Best Ball',
      'scramble': 'Scramble'
    };
    return formatMap[format] || format;
  };

  const handleMatchAction = async (match: any) => {
    if (!user) return;
    
    if (match.user_joined) {
      await leaveMatch(match.id);
    } else {
      // Check if it's a team match
      if (match.is_team_format && match.max_participants > 2) {
        setSelectedMatchForPin(match);
        setTeamJoinDialogOpen(true);
      } else if (match.pin) {
        // Non-team match with PIN
        setSelectedMatchForPin(match);
        setPinDialogOpen(true);
      } else {
        await joinMatch(match.id);
      }
    }
  };

  const handlePinSubmit = async (pin: string) => {
    if (selectedMatchForPin) {
      setPinDialogOpen(false);
      await joinMatch(selectedMatchForPin.id, pin);
      setSelectedMatchForPin(null);
    }
  };

  const handleTeamJoin = async (teamNumber: number, pin?: string, setPin?: string) => {
    if (selectedMatchForPin) {
      setTeamJoinDialogOpen(false);
      await joinMatch(selectedMatchForPin.id, pin, teamNumber, setPin);
      setSelectedMatchForPin(null);
    }
  };

  const isMatchFull = (match: any) => {
    return (match.participant_count || 0) >= match.max_participants;
  };

  const isMatchCompleted = (match: any) => {
    return match.status === 'completed';
  };

  const handleRatePlayersClick = (match: any) => {
    setSelectedMatchForRating(match);
    setRatingDialogOpen(true);
  };

  const handleStartMatch = async (match: any) => {
    if (!user) return;
    
    setStartingMatch(match.id);
    
    try {
      const { data, error } = await supabase.rpc('start_match', {
        match_id: match.id
      });

      if (error) {
        console.error('Error starting match:', error);
        return;
      }

      refetch(); // Refresh matches to update status
    } catch (error) {
      console.error('Error starting match:', error);
    } finally {
      setStartingMatch(null);
    }
  };

  const handleViewScorecard = (match: any) => {
    // For past matches view, toggle inline display
    if (showPastMatches) {
      setExpandedMatchId(expandedMatchId === match.id ? null : match.id);
    } else {
      // For current matches, use modal view
      if (match.status === 'completed') {
        setResultsMatch(match);
      } else {
        setScorecardMatch(match);
      }
    }
  };

  return (
    <section className="py-4 md:py-20 px-3 md:px-6 bg-background" aria-labelledby="match-finder-heading">
      <div className="w-full md:max-w-[1400px] md:mx-auto">
        <div className="text-center mb-16 animate-fade-in px-0 md:px-0">
          <Badge className="mb-4 bg-success/10 text-success border-success/20">
            <span aria-hidden="true">{showPastMatches ? '📜' : '🎯'}</span> {showPastMatches ? 'Match History' : 'Live Match Finder'}
          </Badge>
          <h2 id="match-finder-heading" className="text-4xl md:text-5xl font-bold mb-6 text-foreground">
            {showPastMatches ? 'Your Past Matches' : 'Find Your Perfect Match'}
          </h2>
          {showPastMatches && (
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Review your completed matches, see final results, and track your competitive history.
            </p>
          )}
          {!showPastMatches && (
            <div className="mt-8 flex flex-col items-center justify-center gap-2">
              <CreateMatchButton onMatchCreated={refetch} />
              {location && (
                <p className="text-sm text-muted-foreground">
                  <span aria-hidden="true">📍</span> Location enabled • Showing matches within {searchRadius}mi
                </p>
              )}
            </div>
          )}
        </div>

        {/* Match Filters - Only show for current matches and logged-in users */}
        {!showPastMatches && user && (
          <MatchFilters
            filters={filters}
            onFiltersChange={setFilters}
            matchCount={filteredMatches.length}
            showFilters={showFilters}
            onToggleFilters={() => setShowFilters(!showFilters)}
          />
        )}

        {/* Incomplete Matches Section */}
        {!showPastMatches && incompleteMatches.length > 0 && (
          <div className="mb-8 animate-pulse-subtle">
            <Card className="border-2 border-destructive/50 bg-destructive/5">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="w-6 h-6 text-destructive animate-pulse" />
                    <div>
                      <CardTitle className="text-destructive">Action Required</CardTitle>
                      <CardDescription>
                        {incompleteMatches.length} incomplete {incompleteMatches.length === 1 ? 'match needs' : 'matches need'} to be finalized
                      </CardDescription>
                    </div>
                  </div>
                  <Badge variant="destructive" className="text-lg px-4 py-2">
                    {incompleteMatches.length}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {incompleteMatches.map((match) => {
                    const hoursElapsed = Math.floor(
                      (new Date().getTime() - new Date(match.scheduled_time).getTime()) / (1000 * 60 * 60)
                    );
                    const daysElapsed = Math.floor(hoursElapsed / 24);
                    
                    return (
                      <Card key={match.id} className="border-2 border-destructive/30 bg-card relative overflow-hidden">
                        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-destructive via-orange-500 to-destructive animate-pulse" />
                        <CardHeader className="pb-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <CardTitle className="text-base truncate">{match.course_name}</CardTitle>
                              <CardDescription className="text-sm truncate">{match.location}</CardDescription>
                            </div>
                            <Badge variant="destructive" className="shrink-0">
                              {daysElapsed > 0 ? `${daysElapsed}d ago` : `${hoursElapsed}h ago`}
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div className="text-sm text-muted-foreground">
                            Scheduled: {format(new Date(match.scheduled_time), 'MMM d, h:mm a')}
                          </div>
                          <Button 
                            onClick={() => handleViewScorecard(match)}
                            className="w-full bg-destructive hover:bg-destructive/90"
                            size="lg"
                          >
                            <AlertTriangle className="w-4 h-4 mr-2" />
                            Finalize Match Now
                          </Button>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

            {/* Live Matches */}
            <div className="grid gap-3 md:gap-6 grid-cols-1 py-3">
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
              ) : filteredMatches.length === 0 ? (
                <div className="col-span-full text-center py-12">
                  {matches.length === 0 ? (
                    user ? (
                      <div>
                        <p className="text-muted-foreground text-lg mb-4">
                          {showPastMatches ? 'No past matches yet.' : 'No matches found. Be the first to create one!'}
                        </p>
                        {!showPastMatches && <CreateMatchButton />}
                      </div>
                    ) : null
                  ) : (
                    <div>
                      <p className="text-muted-foreground text-lg mb-4">
                        {showPastMatches ? 'No past matches found.' : 'No matches match your filters.'}
                      </p>
                      {!showPastMatches && (
                        <div className="inline-block shadow-lg rounded-lg border-2 border-primary/20 bg-card hover:border-primary/40 transition-all duration-300">
                          <Button 
                            variant="ghost" 
                            onClick={() => setFilters({
                              search: '',
                              format: 'all', 
                              maxDistance: 30,
                              buyInRange: [0, 500],
                              dateRange: 'all',
                              spots: 'all'
                            })}
                            className="border-0"
                          >
                            Clear Filters
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                filteredMatches.map((match, index) => {
                  const isFull = isMatchFull(match);
                  const isCreatedRecently = new Date(match.created_at) > new Date(Date.now() - 5 * 60 * 1000); // Within 5 minutes
                  const buyInDollars = match.buy_in_amount / 100;
                  const isHighStakes = buyInDollars >= 100;
                  const isMediumStakes = buyInDollars >= 50 && buyInDollars < 100;
                  
                  return (
                    <Card 
                      key={match.id} 
                      className={cn(
                        "relative border transition-all duration-300 hover:shadow-lg animate-slide-up",
                        isHighStakes ? "bg-gradient-to-br from-amber-500/5 to-yellow-500/5 border-amber-500/30 hover:border-amber-500/50" :
                        isMediumStakes ? "bg-gradient-to-br from-primary/5 to-primary/10 border-primary/30 hover:border-primary/50" :
                        "bg-card border-border hover:border-accent"
                      )}
                      style={{ animationDelay: `${index * 0.1}s` }}
                    >
                      {match.status === 'cancelled' && (
                        <Badge className="absolute -top-2 -right-2 bg-destructive/90 text-destructive-foreground border border-destructive">
                          CANCELLED
                        </Badge>
                      )}
                      {match.status === 'completed' && match.winner_id === user?.id && (
                        <Badge className="absolute -top-2 -right-2 bg-gradient-to-r from-amber-500 to-yellow-500 text-white border border-amber-400">
                          <Trophy className="w-3 h-3 mr-1" />
                          WINNER
                        </Badge>
                      )}
                      {isCreatedRecently && match.status !== 'cancelled' && match.status !== 'completed' && (
                        <Badge className="absolute -top-2 -right-2 bg-gradient-to-r from-green-500 to-emerald-500 text-white animate-pulse border border-green-400">
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
                          {hasAccess('gps_matching') && match.distance_km && (
                            <span className="text-primary font-medium">
                              • {formatDistance(match.distance_km)}
                            </span>
                          )}
                        </CardDescription>
                      </CardHeader>
                      
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-primary" />
                            <span className="text-foreground font-medium">{formatMatchTime(match.scheduled_time)}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Users className={cn("w-4 h-4", isFull ? "text-destructive" : "text-success")} />
                            <span className={cn("font-medium", isFull ? "text-destructive" : "text-success")}>
                              {match.participant_count || 0}/{match.max_participants} filled
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <DollarSign className={cn(
                              "w-4 h-4",
                              isHighStakes ? "text-amber-500" : isMediumStakes ? "text-primary" : "text-muted-foreground"
                            )} />
                            <span className={cn(
                              "font-medium",
                              isHighStakes ? "text-amber-500" : isMediumStakes ? "text-primary" : "text-foreground"
                            )}>
                              {(match.buy_in_amount / 100).toFixed(0)} buy-in
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Trophy className="w-4 h-4 text-accent" />
                            <span className="text-foreground">{formatHandicapRange(match.handicap_min, match.handicap_max)}</span>
                          </div>
                        </div>
                        
                        <div className="pt-2 space-y-2">
                          <Badge 
                            variant="outline" 
                            className={cn(
                              "text-xs font-medium",
                              match.format === 'stroke-play' && "border-blue-500/50 text-blue-600 dark:text-blue-400 bg-blue-500/10",
                              match.format === 'match-play' && "border-purple-500/50 text-purple-600 dark:text-purple-400 bg-purple-500/10",
                              match.format === 'best-ball' && "border-green-500/50 text-green-600 dark:text-green-400 bg-green-500/10",
                              match.format === 'scramble' && "border-pink-500/50 text-pink-600 dark:text-pink-400 bg-pink-500/10"
                            )}
                          >
                            {formatMatchFormat(match.format)}
                          </Badge>
                          {match.pin && (
                            <Badge variant="outline" className="text-xs font-medium border-amber-500/50 text-amber-600 dark:text-amber-400 bg-amber-500/10">
                              <Lock className="w-3 h-3 mr-1" />
                              PIN Required
                            </Badge>
                          )}
                        </div>
                        
                        {/* Action Buttons */}
                        <div className="space-y-2">
                          {/* Edit and PIN Management buttons for match creators (only for open matches) */}
                          {match.status === 'open' && match.created_by === user?.id && (
                            <div className="mb-2 flex gap-2">
                              <EditMatchDialog 
                                match={match} 
                                onMatchUpdated={() => refetch()} 
                              />
                              {(match.pin || match.is_team_format) && (
                                <Suspense fallback={null}>
                                  <MatchPinManagement
                                    matchId={match.id}
                                    isCreator={true}
                                    teamPins={[
                                      { 
                                        teamNumber: 1, 
                                        pin: match.pin || null, 
                                        pinCreator: match.team1_pin_creator || null,
                                        canReset: match.team1_pin_creator === user?.id
                                      },
                                      ...(match.is_team_format && match.max_participants >= 4 ? [{
                                        teamNumber: 2,
                                        pin: match.team2_pin || null,
                                        pinCreator: match.team2_pin_creator || null,
                                        canReset: match.team2_pin_creator === user?.id
                                      }] : []),
                                      ...(match.is_team_format && match.max_participants >= 6 ? [{
                                        teamNumber: 3,
                                        pin: match.team3_pin || null,
                                        pinCreator: match.team3_pin_creator || null,
                                        canReset: match.team3_pin_creator === user?.id
                                      }] : []),
                                      ...(match.is_team_format && match.max_participants === 8 ? [{
                                        teamNumber: 4,
                                        pin: match.team4_pin || null,
                                        pinCreator: match.team4_pin_creator || null,
                                        canReset: match.team4_pin_creator === user?.id
                                      }] : [])
                                    ]}
                                    maxParticipants={match.max_participants}
                                    onPinUpdated={() => refetch()}
                                  />
                                </Suspense>
                              )}
                            </div>
                          )}
                          
                          {/* Book Tee Time button - show if booking URL exists and match is open/user joined (but not in past matches view) */}
                          {!showPastMatches && match.booking_url && (match.status === 'open' || match.user_joined) && (
                            <Button
                              variant="outline"
                              className="w-full border-primary text-primary hover:bg-primary hover:text-primary-foreground"
                              onClick={() => window.open(match.booking_url, '_blank')}
                            >
                              <Calendar className="w-4 h-4 mr-2" />
                              Book Tee Time
                            </Button>
                          )}
                          
                          {isMatchCompleted(match) && match.user_joined ? (
                            <>
                              <Button
                                className="w-full bg-gradient-accent text-accent-foreground hover:shadow-premium transition-all duration-300"
                                onClick={() => handleViewScorecard(match)}
                              >
                                <Trophy className="w-4 h-4 mr-2" />
                                {expandedMatchId === match.id ? 'Hide Results' : 'View Results'}
                              </Button>
                              <Button 
                                variant="outline"
                                className="w-full border-accent text-accent hover:bg-accent hover:text-accent-foreground"
                                onClick={() => handleRatePlayersClick(match)}
                              >
                                <Star className="w-4 h-4 mr-2" />
                                Rate Players
                              </Button>
                            </>
                          ) : match.status === 'cancelled' && match.user_joined ? (
                            <Button
                              className="w-full bg-muted text-muted-foreground hover:bg-muted/80"
                              onClick={() => handleViewScorecard(match)}
                            >
                              <Target className="w-4 h-4 mr-2" />
                              {expandedMatchId === match.id ? 'Hide Scorecard' : 'View Scorecard'}
                            </Button>
                          ) : match.status === 'started' && match.user_joined ? (
                            <Button
                              className="w-full bg-gradient-primary text-primary-foreground hover:shadow-premium transition-all duration-300"
                              onClick={() => handleViewScorecard(match)}
                            >
                              <Target className="w-4 h-4 mr-2" />
                              View Scorecard
                            </Button>
                          ) : match.status === 'open' && match.user_joined && isFull ? (
                            <Button
                              className="w-full bg-gradient-accent text-accent-foreground hover:shadow-premium transition-all duration-300"
                              onClick={() => handleStartMatch(match)}
                              disabled={!user || startingMatch === match.id}
                            >
                              <Trophy className="w-4 h-4 mr-2" />
                              {startingMatch === match.id ? "Starting..." : "Start Match"}
                            </Button>
                          ) : (
                            <Button 
                              className={cn(
                                "w-full hover:shadow-premium transition-all duration-300",
                                match.user_joined && !isFull
                                  ? "bg-gradient-accent text-accent-foreground"
                                  : "bg-gradient-primary text-primary-foreground"
                              )}
                              disabled={isFull || !user}
                              onClick={() => handleMatchAction(match)}
                            >
                              {!user ? "Sign In to Join" : 
                               isFull ? "Match Full" : 
                               match.user_joined ? "Leave Match" : 
                               match.pin ? (
                                <>
                                  <Lock className="w-4 h-4 mr-2" />
                                  Join with PIN
                                </>
                               ) : "Join Match"}
                            </Button>
                          )}
                        </div>
                      </CardContent>
                      
                      {/* Inline Scorecard for Past Matches */}
                      {showPastMatches && expandedMatchId === match.id && (
                        <div className="border-t overflow-x-auto w-full">
                          <Suspense fallback={<div className="p-4 text-center text-muted-foreground">Loading scorecard...</div>}>
                            <MatchScorecard
                              matchId={match.id}
                              matchName={match.course_name}
                              readOnly={true}
                            />
                          </Suspense>
                        </div>
                      )}
                    </Card>
                  );
                })
              )}
            </div>

        {/* Rating Dialog */}
        <Suspense fallback={null}>
          <PlayerRatingDialog
            open={ratingDialogOpen}
            onOpenChange={setRatingDialogOpen}
            matchId={selectedMatchForRating?.id || ''}
            matchName={selectedMatchForRating?.course_name || ''}
          />
        </Suspense>

        {/* Scorecard Component */}
        {scorecardMatch && (
          <Dialog open={!!scorecardMatch} onOpenChange={(open) => !open && setScorecardMatch(null)}>
            <DialogContent className="max-w-[95vw] max-h-[95vh] overflow-y-auto p-0">
              <Suspense fallback={<div className="p-8 text-center text-muted-foreground">Loading scorecard...</div>}>
                <MatchScorecard
                  matchId={scorecardMatch.id}
                  matchName={scorecardMatch.course_name}
                  onClose={() => setScorecardMatch(null)}
                  readOnly={scorecardMatch.status === 'completed' || scorecardMatch.status === 'cancelled'}
                />
              </Suspense>
            </DialogContent>
          </Dialog>
        )}

        {/* Results Component */}
        {resultsMatch && (
          <Suspense fallback={<div className="p-8 text-center text-muted-foreground">Loading results...</div>}>
            <MatchResults
              matchId={resultsMatch.id}
              matchName={resultsMatch.course_name}
              onClose={() => setResultsMatch(null)}
            />
          </Suspense>
        )}

        {/* PIN Entry Dialog */}
        <Suspense fallback={null}>
          <PinEntryDialog
            open={pinDialogOpen}
            onOpenChange={setPinDialogOpen}
            onSubmit={handlePinSubmit}
            title="Enter Match PIN"
            description={`This match requires a PIN to join. Contact the match creator for access.`}
          />
        </Suspense>

        {/* Team Join Dialog */}
        {selectedMatchForPin && (
          <Suspense fallback={null}>
            <TeamJoinDialog
              open={teamJoinDialogOpen}
              onOpenChange={setTeamJoinDialogOpen}
              onSubmit={handleTeamJoin}
              maxParticipants={selectedMatchForPin.max_participants}
              occupiedTeams={[1]} // Team 1 is always occupied by creator
            />
          </Suspense>
        )}
        
        {/* How It Works - Only show when not hidden */}
        {!hideHowItWorks && (
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
        )}
      </div>
    </section>
  );
};

export default MatchFinder;