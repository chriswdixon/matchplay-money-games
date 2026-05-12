import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { MapPin, Clock, Users, DollarSign, Trophy, Zap, Navigation, Star, Target, Calendar, Lock, AlertTriangle, Search, X, Filter, ChevronLeft, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMatches } from "@/hooks/useMatches";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { toast } from "sonner";
import { useLocation } from "@/hooks/useLocation";
import { useFreeTier } from "@/hooks/useFreeTier";
import CreateMatchButton from "./CreateMatchButton";
import MatchFilters, { MatchFilters as FilterType } from "./MatchFilters";
import CourseOrMatchSearch from "./CourseOrMatchSearch";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import EditMatchDialog from "./EditMatchDialog";
import { cn } from "@/lib/utils";
import { useState, useEffect, useMemo, useRef, lazy, Suspense } from "react";
import { useIsMobile } from "@/hooks/use-mobile";

// Lazy load heavy dialog components - only loaded when user interacts
const PlayerRatingDialog = lazy(() => import("./PlayerRatingDialog"));
const MatchScorecard = lazy(() => import("./MatchScorecard").then(m => ({ default: m.MatchScorecard })));
const MatchResults = lazy(() => import("./MatchResults").then(m => ({ default: m.MatchResults })));
const PinEntryDialog = lazy(() => import("./PinEntryDialog").then(m => ({ default: m.PinEntryDialog })));
const TeamJoinDialog = lazy(() => import("./TeamJoinDialog").then(m => ({ default: m.TeamJoinDialog })));
const MatchPinManagement = lazy(() => import("./MatchPinManagement").then(m => ({ default: m.MatchPinManagement })));
const JoinMatchConfirmDialog = lazy(() => import("./JoinMatchConfirmDialog"));
const MatchInfoDialog = lazy(() => import("./MatchInfoDialog").then(m => ({ default: m.MatchInfoDialog })));

const MatchFinder = ({ hideHowItWorks = false, showPastMatches = false }: { hideHowItWorks?: boolean; showPastMatches?: boolean }) => {
  const { matches, loading, joinMatch, leaveMatch, refetch } = useMatches();
  const { user } = useAuth();
  const { profile } = useProfile();
  const userHandicap = profile?.handicap !== null && profile?.handicap !== undefined ? Number(profile.handicap) : null;
  const [requestedJoinIds, setRequestedJoinIds] = useState<Set<string>>(new Set());
  const { location, formatDistance } = useLocation();
  const { hasAccess } = useFreeTier();
  const isMobile = useIsMobile();
  const MOBILE_PAGE_SIZE = 3;
  const DESKTOP_PAGE_SIZE = 9;
  const PAGE_SIZE = isMobile ? MOBILE_PAGE_SIZE : DESKTOP_PAGE_SIZE;
  const [page, setPage] = useState(0);
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
  const [confirmJoinMatch, setConfirmJoinMatch] = useState<any>(null);
  const [expandedMatchId, setExpandedMatchId] = useState<string | null>(null);
  const [infoMatchId, setInfoMatchId] = useState<string | null>(null);
  const [pastFilters, setPastFilters] = useState({
    course: '',
    format: 'all',
    dateRange: 'all' as 'all' | '30d' | '90d' | '1y',
  });
  const [showPastFiltersPanel, setShowPastFiltersPanel] = useState(false);

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

  // Load my pending join requests so we can show "Requested" state
  useEffect(() => {
    if (!user) { setRequestedJoinIds(new Set()); return; }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('match_join_requests')
        .select('match_id, status')
        .eq('requester_id', user.id)
        .eq('status', 'pending');
      if (cancelled || !data) return;
      setRequestedJoinIds(new Set(data.map((r: any) => r.match_id)));
    })();
    return () => { cancelled = true; };
  }, [user]);

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
      // Show current/upcoming matches including started matches the user joined
      filtered = filtered.filter(match => {
        // Exclude completed matches
        if (match.status === 'completed') return false;
        
        // Exclude cancelled matches
        if (match.status === 'cancelled') return false;
        
        // Include started matches the user has joined
        if (match.status === 'started') {
          return match.user_joined === true;
        }
        
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

    // Handicap range filter (only for current matches; never hide matches the user already joined or created)
    if (!showPastMatches && userHandicap !== null) {
      filtered = filtered.filter(match => {
        if (match.user_joined || match.created_by === user?.id) return true;
        const min = match.handicap_min;
        const max = match.handicap_max;
        if (min != null && userHandicap < min) return false;
        if (max != null && userHandicap > max) return false;
        return true;
      });
    }

    // Past matches: apply past-specific filters
    if (showPastMatches) {
      if (pastFilters.course) {
        const c = pastFilters.course.toLowerCase();
        filtered = filtered.filter(m => m.course_name.toLowerCase().includes(c));
      }
      if (pastFilters.format !== 'all') {
        filtered = filtered.filter(m => m.format === pastFilters.format);
      }
      if (pastFilters.dateRange !== 'all') {
        const days = pastFilters.dateRange === '30d' ? 30 : pastFilters.dateRange === '90d' ? 90 : 365;
        const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
        filtered = filtered.filter(m => new Date(m.scheduled_time) >= cutoff);
      }
      filtered.sort((a, b) =>
        new Date(b.scheduled_time).getTime() - new Date(a.scheduled_time).getTime()
      );
    }

    return filtered;
  }, [matches, filters, showPastMatches, pastFilters, userHandicap, user?.id]);

  // Unique past courses for filter suggestions
  const pastCourseOptions = useMemo(() => {
    if (!showPastMatches) return [] as string[];
    const set = new Set<string>();
    matches.forEach(m => {
      if ((m.status === 'completed' || m.status === 'cancelled') && m.course_name) set.add(m.course_name);
    });
    return Array.from(set).sort();
  }, [matches, showPastMatches]);

  const pastFormatOptions = useMemo(() => {
    if (!showPastMatches) return [] as string[];
    const set = new Set<string>();
    matches.forEach(m => {
      if ((m.status === 'completed' || m.status === 'cancelled') && m.format) set.add(m.format);
    });
    return Array.from(set).sort();
  }, [matches, showPastMatches]);

  const hasActivePastFilters = pastFilters.course !== '' || pastFilters.format !== 'all' || pastFilters.dateRange !== 'all';

  // Mobile pagination: 3 per page (matches Past Matches pattern)
  useEffect(() => {
    setPage(0);
  }, [filters, showPastMatches, matches.length]);

  const totalPages = Math.max(1, Math.ceil(filteredMatches.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const visibleMatches = filteredMatches.slice(
    safePage * PAGE_SIZE,
    safePage * PAGE_SIZE + PAGE_SIZE,
  );

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

  const handleRequestToJoin = async (match: any) => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from('match_join_requests')
        .insert({ match_id: match.id, requester_id: user.id });
      if (error) {
        if (error.code === '23505') {
          toast.info('You already requested to join this match.');
        } else {
          throw error;
        }
      } else {
        toast.success('Join request sent to the match creator.');
      }
      setRequestedJoinIds(prev => new Set(prev).add(match.id));
    } catch (e: any) {
      toast.error(e?.message || 'Could not send join request');
    }
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
      } else if (match.team1_has_pin) {
        // PIN-protected match: request to join instead of entering PIN
        await handleRequestToJoin(match);
      } else {
        setConfirmJoinMatch(match);
      }
    }
  };

  const handleConfirmDirectJoin = async () => {
    if (confirmJoinMatch) {
      await joinMatch(confirmJoinMatch.id);
      setConfirmJoinMatch(null);
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

  const handlePlayWithBots = async (match: any) => {
    if (!user) return;
    setStartingMatch(match.id);
    try {
      const { data, error } = await supabase.functions.invoke('simulate-bot-match', {
        body: { matchId: match.id },
      });
      if (error || (data && data.error)) {
        console.error('simulate-bot-match failed:', error || data?.error);
        toast.error('Could not add bots to this match');
        return;
      }
      const { error: startErr } = await supabase.rpc('start_match', { match_id: match.id });
      if (startErr) {
        console.error('start_match failed after bot sim:', startErr);
        toast.error('Bots added but match could not be started');
        return;
      }
      toast.success('3 bots joined — match started!');
      refetch();
    } catch (e) {
      console.error('Play with bots failed:', e);
      toast.error('Something went wrong starting the bot match');
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
    <section className="py-4 md:py-12 px-3 md:px-6" aria-labelledby="match-finder-heading">
      <div className="w-full max-w-7xl mx-auto">
        <div className="text-center animate-fade-in px-0 md:px-0">
          <Badge className="mb-4 bg-success/10 text-success border-success/20">
            <span aria-hidden="true">{showPastMatches ? '📜' : '🎯'}</span> {showPastMatches ? 'Match History' : 'Live Match Finder'}
          </Badge>
          <h2 id="match-finder-heading" className="text-3xl md:text-4xl font-bold mb-4 text-foreground tracking-tight">
            {showPastMatches ? 'Your Past Matches' : 'Find Your Perfect Match'}
          </h2>
          {showPastMatches && (
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Review your completed matches, see final results, and track your competitive history.
            </p>
          )}
          {!showPastMatches && user && (
            <div className="mt-4 flex flex-col items-center justify-center gap-2">
              <CreateMatchButton onMatchCreated={refetch} />
            </div>
          )}
        </div>

        {/* Unified Course/Match Search */}
        {!showPastMatches && user && (
          <div className="mb-4">
            <CourseOrMatchSearch
              matchSearch={filters.search}
              onMatchSearchChange={(v) => setFilters({ ...filters, search: v })}
            />
          </div>
        )}

        {/* Match Filters - Only show for current matches and logged-in users */}
        {!showPastMatches && user && (
          <MatchFilters
            filters={filters}
            onFiltersChange={setFilters}
            matchCount={filteredMatches.length}
            showFilters={showFilters}
            onToggleFilters={() => setShowFilters(!showFilters)}
            hideSearch
          />
        )}

        {/* Past Matches Filters (collapsible) */}
        {showPastMatches && user && (
          <div className="mb-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm text-muted-foreground">
                {filteredMatches.length} match{filteredMatches.length === 1 ? '' : 'es'}
              </p>
              <div className="flex items-center gap-2">
                {hasActivePastFilters && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setPastFilters({ course: '', format: 'all', dateRange: 'all' })}
                  >
                    <X className="h-4 w-4 mr-1" /> Clear
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowPastFiltersPanel(v => !v)}
                  aria-expanded={showPastFiltersPanel}
                  aria-controls="past-filters-panel"
                  aria-label={showPastFiltersPanel ? 'Hide filters' : 'Show filters'}
                >
                  <Filter className="h-4 w-4 mr-1" />
                  Filters
                  {hasActivePastFilters && (
                    <Badge variant="secondary" className="ml-2 px-1.5 py-0 text-xs">
                      {[pastFilters.course && 1, pastFilters.format !== 'all' && 1, pastFilters.dateRange !== 'all' && 1].filter(Boolean).length}
                    </Badge>
                  )}
                </Button>
              </div>
            </div>

            {showPastFiltersPanel && (
              <Card id="past-filters-panel" className="bg-muted/30">
                <CardContent className="pt-4">
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2 text-sm">
                        <Search className="h-4 w-4" /> Course
                      </Label>
                      <Input
                        list="past-course-options"
                        placeholder="Any course"
                        value={pastFilters.course}
                        onChange={(e) => setPastFilters({ ...pastFilters, course: e.target.value })}
                      />
                      <datalist id="past-course-options">
                        {pastCourseOptions.map(c => <option key={c} value={c} />)}
                      </datalist>
                    </div>
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2 text-sm">
                        <Users className="h-4 w-4" /> Match Type
                      </Label>
                      <Select
                        value={pastFilters.format}
                        onValueChange={(v) => setPastFilters({ ...pastFilters, format: v })}
                      >
                        <SelectTrigger><SelectValue placeholder="Any format" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Any Format</SelectItem>
                          {pastFormatOptions.map(f => (
                            <SelectItem key={f} value={f}>{f.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2 text-sm">
                        <Calendar className="h-4 w-4" /> Date Range
                      </Label>
                      <Select
                        value={pastFilters.dateRange}
                        onValueChange={(v) => setPastFilters({ ...pastFilters, dateRange: v as typeof pastFilters.dateRange })}
                      >
                        <SelectTrigger><SelectValue placeholder="Any time" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Time</SelectItem>
                          <SelectItem value="30d">Last 30 days</SelectItem>
                          <SelectItem value="90d">Last 90 days</SelectItem>
                          <SelectItem value="1y">Last year</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
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
                        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-destructive via-warning to-destructive animate-pulse" />
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
                <div className="col-span-full">
                  <div className="text-center py-10 px-6 rounded-xl border border-dashed bg-muted/30">
                    <div className="mx-auto w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                      {showPastMatches ? (
                        <Trophy className="w-7 h-7 text-primary" aria-hidden="true" />
                      ) : matches.length === 0 ? (
                        <Calendar className="w-7 h-7 text-primary" aria-hidden="true" />
                      ) : (
                        <Search className="w-7 h-7 text-primary" aria-hidden="true" />
                      )}
                    </div>
                    {matches.length === 0 ? (
                      user ? (
                        <>
                          <p className="font-semibold text-base">
                            {showPastMatches ? 'No past matches yet' : 'No matches available right now'}
                          </p>
                          <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
                            {showPastMatches
                              ? 'Once you finish a match, your history and results will appear here.'
                              : 'Be the first to set one up — pick a course, a format, and an entry amount.'}
                          </p>
                          {!showPastMatches && (
                            <div className="mt-4 flex justify-center">
                              <CreateMatchButton />
                            </div>
                          )}
                        </>
                      ) : null
                    ) : (
                      <>
                        <p className="font-semibold text-base">
                          {showPastMatches ? 'No past matches match your filters' : 'No matches match your filters'}
                        </p>
                        <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
                          Try widening your search radius, clearing the format, or removing the date range.
                        </p>
                        <div className="mt-4 flex flex-wrap justify-center gap-2">
                          {!showPastMatches ? (
                            <Button
                              variant="outline"
                              size="sm"
                              className="rounded-full"
                              onClick={() => setFilters({
                                search: '',
                                format: 'all',
                                maxDistance: 30,
                                buyInRange: [0, 500],
                                dateRange: 'all',
                                spots: 'all',
                              })}
                            >
                              <X className="w-4 h-4 mr-1.5" aria-hidden="true" />
                              Clear filters
                            </Button>
                          ) : hasActivePastFilters ? (
                            <Button
                              variant="outline"
                              size="sm"
                              className="rounded-full"
                              onClick={() => setPastFilters({ course: '', format: 'all', dateRange: 'all' })}
                            >
                              <X className="w-4 h-4 mr-1.5" aria-hidden="true" />
                              Clear filters
                            </Button>
                          ) : null}
                          {!showPastMatches && <CreateMatchButton />}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              ) : (
                visibleMatches.map((match, index) => {
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
                        isHighStakes ? "bg-gradient-to-br from-warning/5 to-warning/10 border-warning/30 hover:border-warning/50" :
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
                        <Badge className="absolute -top-2 -right-2 bg-gradient-to-r from-warning to-warning/70 text-primary-foreground border border-warning/40">
                          <Trophy className="w-3 h-3 mr-1" />
                          WINNER
                        </Badge>
                      )}
                      {isCreatedRecently && match.status !== 'cancelled' && match.status !== 'completed' && (
                        <Badge className="absolute -top-2 -right-2 bg-gradient-to-r from-success to-success/70 text-primary-foreground animate-pulse border border-success/40">
                          <Zap className="w-3 h-3 mr-1" />
                          NEW
                        </Badge>
                      )}
                      
                      <CardHeader
                        className="pb-4 cursor-pointer"
                        onClick={() => setInfoMatchId(match.id)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setInfoMatchId(match.id);
                          }
                        }}
                        aria-label={`View details for ${match.course_name}`}
                      >
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
                              isHighStakes ? "text-warning" : isMediumStakes ? "text-primary" : "text-muted-foreground"
                            )} />
                            <span className={cn(
                              "font-medium",
                              isHighStakes ? "text-warning" : isMediumStakes ? "text-primary" : "text-foreground"
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
                              match.format === 'best-ball' && "border-success/50 text-success bg-success/10",
                              match.format === 'scramble' && "border-pink-500/50 text-pink-600 dark:text-pink-400 bg-pink-500/10"
                            )}
                          >
                            {formatMatchFormat(match.format)}
                          </Badge>
                          {match.team1_has_pin && (
                            <Badge variant="outline" className="text-xs font-medium border-warning/50 text-warning bg-warning/10">
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
                              {(match.team1_pin_creator || match.is_team_format) && (
                                <Suspense fallback={null}>
                                  <MatchPinManagement
                                    matchId={match.id}
                                    isCreator={true}
                                    teamPins={[
                                      { 
                                        teamNumber: 1, 
                                        pin: null, 
                                        pinCreator: match.team1_pin_creator || null,
                                        canReset: match.team1_pin_creator === user?.id
                                      },
                                      ...(match.is_team_format && match.max_participants >= 4 ? [{
                                        teamNumber: 2,
                                        pin: null,
                                        pinCreator: match.team2_pin_creator || null,
                                        canReset: match.team2_pin_creator === user?.id
                                      }] : []),
                                      ...(match.is_team_format && match.max_participants >= 6 ? [{
                                        teamNumber: 3,
                                        pin: null,
                                        pinCreator: match.team3_pin_creator || null,
                                        canReset: match.team3_pin_creator === user?.id
                                      }] : []),
                                      ...(match.is_team_format && match.max_participants === 8 ? [{
                                        teamNumber: 4,
                                        pin: null,
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
                              Book Tee Time
                            </Button>
                          )}
                          
                          {isMatchCompleted(match) && match.user_joined ? (
                            <>
                              <Button
                                className="w-full bg-gradient-accent text-accent-foreground hover:shadow-premium transition-all duration-300"
                                onClick={() => handleViewScorecard(match)}
                              >
                                {expandedMatchId === match.id ? 'Hide Results' : 'View Results'}
                              </Button>
                              <Button 
                                variant="outline"
                                className="w-full border-accent text-accent hover:bg-accent hover:text-accent-foreground"
                                onClick={() => handleRatePlayersClick(match)}
                              >
                                Rate Players
                              </Button>
                            </>
                          ) : match.status === 'cancelled' && match.user_joined ? (
                            <Button
                              className="w-full bg-muted text-muted-foreground hover:bg-muted/80"
                              onClick={() => handleViewScorecard(match)}
                            >
                              {expandedMatchId === match.id ? 'Hide Scorecard' : 'View Scorecard'}
                            </Button>
                          ) : match.status === 'started' && match.user_joined ? (
                            <Button
                              className="w-full bg-gradient-primary text-primary-foreground hover:shadow-premium transition-all duration-300"
                              onClick={() => handleViewScorecard(match)}
                            >
                              Open Scorecard to Complete Match
                            </Button>
                          ) : match.status === 'open' && match.user_joined && isFull ? (
                            <Button
                              className="w-full bg-gradient-accent text-accent-foreground hover:shadow-premium transition-all duration-300"
                              onClick={() => handleStartMatch(match)}
                              disabled={!user || startingMatch === match.id}
                            >
                              {startingMatch === match.id ? "Starting..." : "Start Match"}
                            </Button>
                          ) : match.status === 'open' && match.created_by === user?.id && (match.participant_count || 0) === 1 ? (
                            <>
                              <Button
                                className="w-full bg-gradient-primary text-primary-foreground hover:shadow-premium transition-all duration-300"
                                onClick={() => handlePlayWithBots(match)}
                                disabled={!user || startingMatch === match.id}
                              >
                                {startingMatch === match.id ? "Adding bots..." : "Play vs 3 Bots (Solo)"}
                              </Button>
                              <Button
                                variant="outline"
                                className="w-full"
                                onClick={() => handleMatchAction(match)}
                                disabled={!user}
                              >
                                Leave Match
                              </Button>
                            </>
                          ) : match.status === 'cancelled' ? null : (
                            <Button 
                              className={cn(
                                "w-full hover:shadow-premium transition-all duration-300",
                                match.user_joined && !isFull
                                  ? "bg-gradient-accent text-accent-foreground"
                                  : "bg-gradient-primary text-primary-foreground"
                              )}
                              disabled={isFull || !user || (match.pin && !match.user_joined && requestedJoinIds.has(match.id))}
                              onClick={() => handleMatchAction(match)}
                            >
                              {!user ? "Sign In to Join" :
                               isFull ? "Match Full" :
                               match.user_joined ? "Leave Match" :
                               match.pin
                                 ? (requestedJoinIds.has(match.id) ? "Request Sent" : "Request to Join")
                                 : "Join Match"}
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
            {filteredMatches.length > PAGE_SIZE && (
              <div className="flex items-center justify-center gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={safePage === 0}
                  aria-label="Previous page"
                  className="h-8 w-8"
                >
                  <ChevronLeft className="w-4 h-4" aria-hidden="true" />
                </Button>
                <div className="flex items-center gap-1.5" aria-hidden="true">
                  {Array.from({ length: Math.min(totalPages, 8) }).map((_, i) => (
                    <span
                      key={i}
                      className={
                        i === safePage
                          ? 'w-2 h-2 rounded-full bg-primary'
                          : 'w-2 h-2 rounded-full bg-muted-foreground/30'
                      }
                    />
                  ))}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={safePage >= totalPages - 1}
                  aria-label="Next page"
                  className="h-8 w-8"
                >
                  <ChevronRight className="w-4 h-4" aria-hidden="true" />
                </Button>
              </div>
            )}

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

        {/* Join Confirmation Dialog */}
        <Suspense fallback={null}>
          <JoinMatchConfirmDialog
            open={!!confirmJoinMatch}
            onOpenChange={(o) => !o && setConfirmJoinMatch(null)}
            match={confirmJoinMatch}
            onConfirm={handleConfirmDirectJoin}
          />
        </Suspense>
        
        {/* Match Info Dialog (tee time, scorecard, payouts) */}
        <Suspense fallback={null}>
          <MatchInfoDialog
            matchId={infoMatchId}
            open={!!infoMatchId}
            onOpenChange={(o) => !o && setInfoMatchId(null)}
          />
        </Suspense>

        {/* How It Works - Only show when not hidden */}
        {!hideHowItWorks && (
          <div className="bg-muted rounded-2xl p-8 md:p-12">
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