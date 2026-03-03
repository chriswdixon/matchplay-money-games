import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useMatchScoring, PlayerScore, MatchData } from '@/hooks/useMatchScoring';
import { useAuth } from '@/hooks/useAuth';
import { useMatches } from '@/hooks/useMatches';
import { useActiveMatch } from '@/hooks/useActiveMatch';
import { useCancellationConfirmations } from '@/hooks/useCancellationConfirmations';
import { supabase } from '@/integrations/supabase/client';
import { Target, Trophy, Clock, CheckCircle, Users, ChevronDown, DollarSign, Menu, X, Check, AlertTriangle, Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MatchResultsDisplay } from './MatchResultsDisplay';
import { CancellationConfirmationDialog } from './CancellationConfirmationDialog';
import PlayerRatingDialog from './PlayerRatingDialog';
import { toast } from '@/hooks/use-toast';

interface MatchScorecardProps {
  matchId: string;
  matchName: string;
  onClose?: () => void;
  readOnly?: boolean;
}

export function MatchScorecard({ matchId, matchName, onClose, readOnly = false }: MatchScorecardProps) {
  const { user } = useAuth();
  const { leaveMatch, refetch } = useMatches();
  const { clearActiveMatch } = useActiveMatch();
  const {
    playerScores,
    matchData,
    matchResult,
    confirmations,
    loading,
    saving,
    updateScore,
    finalizeResults,
    confirmResults,
    recordDoubleDownVote,
    processDoubleDownPayments,
    isMatchComplete,
    canFinalize,
    isCurrentPlayerComplete,
    hasCurrentPlayerFinished,
    allPlayersFinished,
    isPlayerComplete
  } = useMatchScoring(matchId);

  const [editingHole, setEditingHole] = useState<number | null>(null);
  const [tempScore, setTempScore] = useState<string>('');
  const [scoreDialogOpen, setScoreDialogOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(typeof window !== 'undefined' && window.innerWidth >= 768);
  const [userClosedSettings, setUserClosedSettings] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState<string>('');
  const [isLeaving, setIsLeaving] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [doubleDownDialogOpen, setDoubleDownDialogOpen] = useState(false);
  const [hasShownDoubleDown, setHasShownDoubleDown] = useState(false);
  const [doubleDownStatuses, setDoubleDownStatuses] = useState<any[]>([]);
  const [isProcessingDoubleDown, setIsProcessingDoubleDown] = useState(false);
  const [activeTab, setActiveTab] = useState('front9');
  const [ratingDialogOpen, setRatingDialogOpen] = useState(false);
  const [hasPromptedForRating, setHasPromptedForRating] = useState(false);

  // Debug: Log match status changes
  useEffect(() => {
    if (matchData) {
      console.log('🔍 MatchScorecard - matchData status:', {
        status: matchData.status,
        isCancelled: matchData.status === 'cancelled',
        shouldShowButton: matchData.status !== 'cancelled',
        loading,
        matchResult: !!matchResult
      });
    }
  }, [matchData?.status, loading, matchResult]);

  // Debug: Log winner badge data
  useEffect(() => {
    console.log('🏆 Winner Badge Debug:', {
      matchResult_winner_id: matchResult?.winner_id,
      user_id: user?.id,
      matches: matchResult?.winner_id === user?.id,
      showBadge: !!(matchResult?.winner_id && user?.id && matchResult.winner_id === user.id)
    });
  }, [matchResult, user]);

  const [expandedOtherPlayers, setExpandedOtherPlayers] = useState<Record<number, boolean>>({});
  const [currentConfirmationIndex, setCurrentConfirmationIndex] = useState(0);
  const activeHoleRef = useRef<HTMLDivElement>(null);

  const { pendingConfirmations, confirmCancellation } = useCancellationConfirmations(matchId);

  const toggleOtherPlayers = (hole: number) => {
    setExpandedOtherPlayers(prev => ({
      ...prev,
      [hole]: !prev[hole]
    }));
  };

  const currentUserScore = playerScores.find(p => p.player_id === user?.id);
  const otherPlayers = playerScores.filter(p => p.player_id !== user?.id);

  // Helper function to determine if a hole should be displayed for cancelled matches
  const shouldShowHole = (hole: number): boolean => {
    if (matchData?.status !== 'cancelled') return true;
    // For cancelled matches, only show holes that have at least one score
    return playerScores.some(player => player.scores[hole] !== undefined && player.scores[hole] !== null);
  };

  // Get displayable holes for each nine
  const front9Holes = Array.from({ length: 9 }, (_, i) => i + 1).filter(shouldShowHole);
  const back9Holes = Array.from({ length: 9 }, (_, i) => i + 10).filter(shouldShowHole);

  // Scroll to active hole on mobile
  useEffect(() => {
    if (activeHoleRef.current && window.innerWidth < 768) {
      setTimeout(() => {
        activeHoleRef.current?.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'center'
        });
      }, 300);
    }
  }, [currentUserScore?.scores]);

  // Auto-expand settings when match is 100% complete for current user
  useEffect(() => {
    const requiredHoles = matchData?.holes || 18;
    if (currentUserScore && Object.keys(currentUserScore.scores).length === requiredHoles) {
      setSettingsOpen(true);
      setUserClosedSettings(false);
    }
  }, [currentUserScore, matchData?.holes]);

  // Prompt for player ratings when match completes
  useEffect(() => {
    if (
      matchResult && 
      matchData?.status === 'completed' && 
      !hasPromptedForRating && 
      playerScores.length > 1
    ) {
      // Small delay to let results display first
      const timer = setTimeout(() => {
        setRatingDialogOpen(true);
        setHasPromptedForRating(true);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [matchResult, matchData?.status, hasPromptedForRating, playerScores.length]);

  // Fetch double down statuses
  useEffect(() => {
    if (!matchId || !user) return;

    const fetchDoubleDownStatuses = async () => {
      const { data } = await supabase
        .from('double_down_participants_public' as any)
        .select('*')
        .eq('match_id', matchId);

      if (data) {
        setDoubleDownStatuses(data);
      }
    };

    fetchDoubleDownStatuses();

    // Subscribe to real-time updates
    const channel = supabase
      .channel(`double_down_${matchId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'double_down_participants',
        filter: `match_id=eq.${matchId}`
      }, () => {
        fetchDoubleDownStatuses();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [matchId, user]);

  // Check if should show double down dialog when switching to back 9
  useEffect(() => {
    if (
      activeTab === 'back9' &&
      !hasShownDoubleDown &&
      matchData?.status === 'started' &&
      matchData?.holes === 18 &&
      !matchData?.double_down_finalized &&
      user
    ) {
      // Check if current user has already responded
      const myStatus = doubleDownStatuses.find(s => s.user_id === user.id);
      if (!myStatus?.responded) {
        setDoubleDownDialogOpen(true);
        setHasShownDoubleDown(true);
      }
    }
  }, [activeTab, hasShownDoubleDown, matchData, user, doubleDownStatuses]);

  const handleDoubleDownVote = async (optedIn: boolean) => {
    setIsProcessingDoubleDown(true);
    try {
      const result = await recordDoubleDownVote(optedIn);
      
      if (result.allAgreed && result.needsProcessing) {
        // Payments will be processed automatically
        toast({ title: "Success", description: "All players agreed! Processing payments..." });
      } else if (result.doubleDownCancelled) {
        toast({ title: "Declined", description: "Double down declined by one or more players" });
        setDoubleDownDialogOpen(false);
      } else if (result.waiting) {
        toast({ title: "Vote Recorded", description: `Waiting for ${result.pendingCount} more player(s)...` });
      }
    } catch (error) {
      console.error('Error voting on double down:', error);
    } finally {
      setIsProcessingDoubleDown(false);
    }
  };

  const handleScoreEdit = (hole: number, currentScore?: number) => {
    setEditingHole(hole);
    setTempScore(currentScore?.toString() || '');
    setScoreDialogOpen(true);
  };

  const handleScoreSave = async () => {
    if (!editingHole || !tempScore) return;

    const strokes = parseInt(tempScore);
    if (isNaN(strokes) || strokes < 1 || strokes > 10) {
      return;
    }

    const success = await updateScore(editingHole, strokes);
    if (success) {
      setEditingHole(null);
      setTempScore('');
      setScoreDialogOpen(false);
    }
  };

  const handleScoreCancel = () => {
    setEditingHole(null);
    setTempScore('');
    setScoreDialogOpen(false);
  };

  const handleQuickScore = async (score: number) => {
    if (!editingHole) return;
    
    const success = await updateScore(editingHole, score);
    if (success) {
      setEditingHole(null);
      setTempScore('');
      setScoreDialogOpen(false);
    }
  };

  const handleFinishMatch = async () => {
    await confirmResults();
  };

  const handleFinalize = async () => {
    // Try to finalize directly first, fall back to confirmResults
    const finalized = await finalizeResults();
    if (!finalized) {
      // If direct finalization fails, try confirm flow
      await confirmResults();
    }
  };

  const handleConfirm = async () => {
    await confirmResults();
  };

  const handleCancelMatch = async () => {
    if (!cancelReason || !user) {
      toast({
        title: "Reason Required",
        description: "Please select a reason for leaving the match.",
        variant: "destructive"
      });
      return;
    }

    // Prevent leaving a cancelled match
    if (matchData?.status === 'cancelled') {
      toast({
        title: "Match Already Cancelled",
        description: "This match has already been cancelled.",
        variant: "destructive"
      });
      setCancelDialogOpen(false);
      return;
    }

    setIsLeaving(true);
    try {
      // Call the new RPC function to handle DNF logic
      const { data, error } = await supabase.rpc('leave_match_with_dnf', {
        p_match_id: matchId,
        p_user_id: user.id,
        p_reason: cancelReason
      });

      if (error) throw error;

      // Create confirmation requests for all other active players
      const otherActivePlayers = playerScores
        .filter(p => p.player_id !== user.id && p.status !== 'dnf');
      
      if (otherActivePlayers.length > 0) {
        const confirmationRequests = otherActivePlayers.map(player => ({
          match_id: matchId,
          cancelling_player_id: user.id,
          stated_reason: cancelReason,
          confirming_player_id: player.player_id
        }));

        const { error: confirmError } = await supabase
          .from('match_cancellation_confirmations')
          .insert(confirmationRequests);

        if (confirmError) {
          console.error('Error creating confirmation requests:', confirmError);
        }
      }

      clearActiveMatch();
      
      // Refresh matches to update the UI
      await refetch();
      
      // Show different messages based on outcome
      const result = data as { 
        status: string; 
        remaining_players: number; 
        match_status: string; 
        refund_eligible: boolean;
        refund_amount?: number;
        cancellation_fee?: number;
      };
      
      if (result.status === 'dnf') {
        if (result.refund_eligible && result.refund_amount !== undefined) {
          const refundDollars = (result.refund_amount / 100).toFixed(2);
          toast({
            title: "Marked as DNF",
            description: `You have been marked as Did Not Finish. Refund of $${refundDollars} processed (minus $2 cancellation fee). The match will continue with ${result.remaining_players} remaining player${result.remaining_players !== 1 ? 's' : ''}.`,
          });
        } else {
          toast({
            title: "Marked as DNF",
            description: `You have been marked as Did Not Finish and forfeit your buy-in. The match will continue with ${result.remaining_players} remaining player${result.remaining_players !== 1 ? 's' : ''}.`,
            variant: "destructive"
          });
        }
      } else {
        if (result.refund_amount !== undefined) {
          const refundDollars = (result.refund_amount / 100).toFixed(2);
          toast({
            title: "Match Cancelled",
            description: `All players have left. The match has been cancelled. Refund of $${refundDollars} processed (minus $2 cancellation fee).`,
          });
        } else {
          toast({
            title: "Match Cancelled",
            description: "All players have left. The match has been cancelled. Refunds will be processed minus a $2 cancellation fee.",
          });
        }
      }
      
      setCancelDialogOpen(false);
      // Navigate back or close if onClose is provided
      if (onClose) {
        onClose();
      }
    } catch (error) {
      console.error('Error leaving match:', error);
      toast({
        title: "Error",
        description: "An unexpected error occurred.",
        variant: "destructive"
      });
    } finally {
      setIsLeaving(false);
    }
  };

  const formatMatchTime = (scheduledTime?: string) => {
    if (!scheduledTime) return 'Not scheduled';
    const date = new Date(scheduledTime);
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    }).format(date);
  };

  const formatBuyIn = (buyInCents?: number) => {
    if (!buyInCents) return '$0';
    return `$${(buyInCents / 100).toFixed(0)}`;
  };

  const formatMatchFormat = (format?: string) => {
    if (!format) return 'Standard';
    const formatMap: { [key: string]: string } = {
      'stroke-play': 'Stroke Play',
      'match-play': 'Match Play',
      'best-ball': 'Best Ball',
      'scramble': 'Scramble'
    };
    return formatMap[format] || format;
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/3"></div>
          <div className="h-64 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn(
      "w-full space-y-0 md:space-y-2",
      onClose ? "max-w-[1400px] mx-auto px-0 overflow-x-hidden" : "max-w-full"
    )}>
      {/* Header with Course Name and Hamburger Menu */}
      {onClose && (
        <div className="px-4 md:px-6">
          <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-primary rounded-lg">
              <Target className="w-5 h-5 text-primary-foreground" />
            </div>
            <h1 className="text-xl md:text-2xl font-bold">
              {matchData?.course_name || matchName || 'Golf Match'}
            </h1>
            {matchResult?.winner_id && user?.id && matchResult.winner_id === user.id && (
              <Badge variant="success">Winner</Badge>
            )}
          </div>
          
          {/* Back/Toggle Button for Cancelled/Completed Matches or Hamburger Menu */}
          {matchData?.status === 'cancelled' || matchData?.status === 'completed' ? (
            <div className="flex gap-2 flex-wrap justify-end">
              {matchData?.status === 'completed' && matchResult && (
                <Button
                  variant="outline"
                  onClick={() => setShowResults(!showResults)}
                >
                  {showResults ? 'Hide Results' : 'View Results'}
                </Button>
              )}
              {onClose && (
                <Button
                  variant="success"
                  onClick={onClose}
                >
                  Close Details
                </Button>
              )}
            </div>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                setSettingsOpen(!settingsOpen);
                if (settingsOpen) {
                  setUserClosedSettings(true);
                }
              }}
              className="h-10 w-10"
            >
              {settingsOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          )}
        </div>

        {/* Match Age Warning Banner */}
        {matchData?.status === 'started' && matchData?.scheduled_time && (() => {
          const hoursElapsed = Math.floor(
            (new Date().getTime() - new Date(matchData.scheduled_time).getTime()) / (1000 * 60 * 60)
          );
          const daysElapsed = Math.floor(hoursElapsed / 24);
          
          // Only show if match is >6 hours old
          if (hoursElapsed < 6) return null;
          
          // Determine urgency level based on 24-hour deadline
          const urgency = hoursElapsed < 24 ? 'warning' : hoursElapsed < 48 ? 'alert' : 'critical';
          const bgColor = urgency === 'warning' ? 'bg-yellow-500/10 border-yellow-500/30' : 
                         urgency === 'alert' ? 'bg-orange-500/10 border-orange-500/30' :
                         'bg-destructive/10 border-destructive/30';
          const textColor = urgency === 'warning' ? 'text-yellow-600 dark:text-yellow-400' :
                           urgency === 'alert' ? 'text-orange-600 dark:text-orange-400' :
                           'text-destructive';
          const iconColor = urgency === 'warning' ? 'text-yellow-500' :
                           urgency === 'alert' ? 'text-orange-500' :
                           'text-destructive';
          
          return (
            <Card className={cn("mt-4 border-2", bgColor)}>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className={cn("w-5 h-5 shrink-0 mt-0.5", iconColor, urgency === 'critical' && 'animate-pulse')} />
                  <div className="flex-1">
                    <div className={cn("font-semibold mb-1", textColor)}>
                      {urgency === 'critical' ? '⚠️ Critical: 24-Hour Deadline Exceeded - Admin Review Pending' :
                       urgency === 'alert' ? '⚠️ Alert: Match Approaching 24-Hour Deadline' :
                       '⚠️ Reminder: Complete Within 24 Hours'}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      This match was scheduled for{' '}
                      <span className="font-medium">
                        {new Intl.DateTimeFormat('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit'
                        }).format(new Date(matchData.scheduled_time))}
                      </span>
                      {' '}({daysElapsed > 0 ? `${daysElapsed} day${daysElapsed > 1 ? 's' : ''}` : `${hoursElapsed} hours`} ago).
                      {hoursElapsed >= 24 ? (
                        <span className={cn("block mt-1 font-medium", textColor)}>
                          This match has exceeded the 24-hour completion deadline and will be sent to admins for review. 
                          Players who haven't completed their round may forfeit payouts.
                        </span>
                      ) : (
                        <span className="block mt-1 font-medium">
                          You have {24 - hoursElapsed} hours remaining to complete and finalize this match.
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })()}

        {/* Match Settings Collapsible Content */}
        <Collapsible 
          open={settingsOpen} 
          onOpenChange={(open) => {
            setSettingsOpen(open);
            if (!open) {
              setUserClosedSettings(true);
            }
          }}
        >
          <CollapsibleContent className="mt-4 space-y-4">
            {/* Match Info Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Card className="bg-card/50">
                <CardContent className="p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Clock className="w-4 h-4 text-primary" />
                    <div className="text-xs text-muted-foreground">Tee Time</div>
                  </div>
                  <div className="text-sm font-semibold">{formatMatchTime(matchData?.scheduled_time)}</div>
                </CardContent>
              </Card>
              
              <Card className="bg-card/50">
                <CardContent className="p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Users className="w-4 h-4 text-primary" />
                    <div className="text-xs text-muted-foreground">Players</div>
                  </div>
                  <div className="text-sm font-semibold">{matchData?.participant_count || 0}/{matchData?.max_participants || 4}</div>
                </CardContent>
              </Card>
              
              <Card className="bg-card/50">
                <CardContent className="p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <DollarSign className="w-4 h-4 text-primary" />
                    <div className="text-xs text-muted-foreground">Buy-in</div>
                  </div>
                  <div className="text-sm font-semibold">{((matchData?.buy_in_amount || 0) / 100).toFixed(0)}</div>
                </CardContent>
              </Card>
              
              <Card className="bg-card/50">
                <CardContent className="p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Trophy className="w-4 h-4 text-primary" />
                    <div className="text-xs text-muted-foreground">Format</div>
                  </div>
                  <div className="text-sm font-semibold">{formatMatchFormat(matchData?.format)}</div>
                </CardContent>
              </Card>
            </div>

            {/* Tee Information Banner */}
            {matchData && (
              <Card className="bg-muted/50 border-primary/20">
                <CardContent className="p-4">
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2 text-sm">
                      <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
                        Playing Tees
                      </Badge>
                      {matchData.tee_selection_mode === 'fixed' && matchData.default_tees ? (
                        <span className="font-medium">
                          All players: <span className="text-primary font-bold">{matchData.default_tees}</span> tees
                        </span>
                      ) : matchData.tee_selection_mode === 'individual' ? (
                        <span className="font-medium text-muted-foreground">
                          Individual tee selection
                        </span>
                      ) : (
                        <span className="font-medium text-muted-foreground">
                          Tees not specified
                        </span>
                      )}
                    </div>
                    {matchData.tee_data && (
                      <div className="grid grid-cols-3 gap-3 text-xs mt-1">
                        <div className="bg-background rounded px-2 py-1.5">
                          <div className="text-muted-foreground">Slope</div>
                          <div className="font-bold text-foreground text-sm">{matchData.tee_data.slope_rating}</div>
                        </div>
                        <div className="bg-background rounded px-2 py-1.5">
                          <div className="text-muted-foreground">Rating</div>
                          <div className="font-bold text-foreground text-sm">{matchData.tee_data.course_rating}</div>
                        </div>
                        <div className="bg-background rounded px-2 py-1.5">
                          <div className="text-muted-foreground">Yards</div>
                          <div className="font-bold text-foreground text-sm">{matchData.tee_data.total_yards?.toLocaleString()}</div>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Player Summary */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              {playerScores.map((player) => {
                const confirmation = confirmations.find(c => c.player_id === player.player_id);
                const hasConfirmed = confirmation?.confirmed || false;
                
                return (
                   <Card key={player.player_id} className={player.player_id === user?.id ? 'ring-2 ring-primary bg-primary/5' : 'bg-card'}>
                    <CardContent className="p-4">
                       <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4 text-muted-foreground" />
                          <span className="font-medium truncate">{player.player_name}</span>
                          {player.player_id === user?.id && (
                            <Badge variant="default" className="text-xs bg-primary">You</Badge>
                          )}
                          {player.status === 'dnf' && (
                            <Badge variant="destructive" className="text-xs">DNF</Badge>
                          )}
                        </div>
                        {hasConfirmed && (
                          <Check className="w-5 h-5 text-green-600" />
                        )}
                      </div>
                      <div className="flex items-start justify-between mt-2">
                        <div>
                          <div className="text-xs text-muted-foreground">Handicap</div>
                          <div className="text-sm font-semibold">{player.handicap_index.toFixed(1)}</div>
                          <div className="text-xs text-muted-foreground">CH: {player.course_handicap}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold text-primary">{player.net_total || 0}</div>
                          <div className="text-xs text-muted-foreground">Net ({player.total || 0})</div>
                          <div className="text-xs text-muted-foreground">
                            F9: {player.net_front9} ({player.front9}) | B9: {player.net_back9} ({player.back9})
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {Object.keys(player.scores).length}/{matchData?.holes || 18} holes
                          </div>
                        </div>
                      </div>
                      
                      {/* Progress Bar */}
                      <div className="mt-3">
                        <div className="w-full bg-muted rounded-full h-2">
                          <div 
                            className="bg-primary h-2 rounded-full transition-all duration-300" 
                            style={{ width: `${(Object.keys(player.scores).length / (matchData?.holes || 18)) * 100}%` }}
                          ></div>
                        </div>
                        <div className="text-xs text-muted-foreground mt-1 text-center">
                          {Math.round((Object.keys(player.scores).length / (matchData?.holes || 18)) * 100)}% Complete
                          {hasConfirmed && (
                            <span className="ml-2 text-green-600 font-medium">✓ Finished</span>
                          )}
                        </div>
                      </div>

                      {/* Leave Match Button - Mobile Only - Only shown for current user */}
                      {player.player_id === user?.id && !matchResult && !loading && matchData?.status !== 'cancelled' && (
                        <div className="mt-3 md:hidden">
                          <Button
                            onClick={() => setCancelDialogOpen(true)}
                            className="w-full bg-gradient-accent text-accent-foreground hover:shadow-premium transition-all duration-300"
                          >
                            <AlertTriangle className="w-4 h-4 mr-2" />
                            Leave Match
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>
      )}

      {/* Finish Match Button - Shows when current player completed all holes but hasn't finished yet */}
      {isCurrentPlayerComplete && !hasCurrentPlayerFinished && !matchResult && matchData?.status === 'started' && (
        <div className="flex flex-col items-center gap-4 px-6 py-4">
          <div className="text-center">
            <h3 className="text-lg font-semibold mb-2">🎉 You've completed all {matchData?.holes || 18} holes!</h3>
            <p className="text-sm text-muted-foreground">
              {confirmations.filter(c => c.confirmed).length} of {playerScores.length} players have finished
            </p>
            {!canFinalize && (
              <p className="text-xs text-muted-foreground mt-1">
                Waiting for other players to complete their round...
              </p>
            )}
          </div>
          <Button
            onClick={handleFinishMatch}
            disabled={saving}
            size="lg"
            className="bg-gradient-primary text-primary-foreground hover:shadow-premium text-base"
          >
            <Trophy className="w-5 h-5 mr-2" />
            {saving ? "Finishing..." : "Finish the Match"}
          </Button>
        </div>
      )}

      {/* Waiting for others - Shows when current player has finished but waiting for others */}
      {/* You've Finished Section - Shows when current player has finished */}
      {((hasCurrentPlayerFinished && matchData?.status === 'started') || (matchData?.status === 'completed' && matchResult)) && (
        <div className="flex flex-col items-center gap-4 px-6 py-4">
          <div className="text-center">
            <h3 className="text-lg font-semibold mb-2">✅ You've Finished!</h3>
            
            {/* Waiting message - only during started match */}
            {hasCurrentPlayerFinished && !matchResult && matchData?.status === 'started' && (
              <>
                {confirmations.filter(c => c.confirmed).length < playerScores.filter(p => p.status === 'active').length ? (
                  <>
                    <p className="text-sm text-muted-foreground">
                      Waiting for {playerScores.filter(p => p.status === 'active').length - confirmations.filter(c => c.confirmed).length} more player(s) to finish...
                    </p>
                    <div className="flex flex-wrap justify-center gap-2 mt-3">
                      {playerScores.map(player => {
                        const playerConfirmed = confirmations.find(c => c.player_id === player.player_id)?.confirmed;
                        const playerComplete = isPlayerComplete(player.player_id);
                        return (
                          <Badge 
                            key={player.player_id}
                            variant={playerConfirmed ? "success" : playerComplete ? "outline" : "secondary"}
                            className="text-xs"
                          >
                            {player.player_name}: {playerConfirmed ? "Finished ✓" : playerComplete ? "Completing..." : `${Object.keys(player.scores).length}/${matchData?.holes || 18}`}
                          </Badge>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  // All confirmed but not finalized - show finalize button
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      All players have finished! Ready to see results.
                    </p>
                    <Button
                      onClick={handleFinalize}
                      disabled={saving}
                      className="bg-gradient-primary text-primary-foreground gap-2"
                    >
                      <Trophy className="w-4 h-4" />
                      {saving ? "Finalizing..." : "Show Results"}
                    </Button>
                  </div>
                )}
              </>
            )}

            {/* Completed message */}
            {matchData?.status === 'completed' && matchResult && (
              <p className="text-sm text-muted-foreground">
                Match completed! See the results above.
              </p>
            )}

            {/* Rate Players - Always show when 2+ players */}
            {playerScores.length > 1 && (
              <div className="mt-4">
                <p className="text-sm text-muted-foreground mb-3">
                  How was your experience playing with others?
                </p>
                <Button
                  onClick={() => setRatingDialogOpen(true)}
                  className="gap-2"
                >
                  <Star className="w-4 h-4" />
                  Rate Players
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Display Results when all confirmed */}
      {matchResult && showResults && (
        <MatchResultsDisplay 
          matchResult={matchResult}
          playerScores={playerScores}
          buyInAmount={matchData?.buy_in_amount}
          maxParticipants={matchData?.max_participants}
          inline={!onClose}
        />
      )}

      {/* Scorecard */}
      {(!matchResult || !showResults) && (
        <Card className={cn(
          "w-full border-0 md:border",
          !onClose && "shadow-none"
        )}>
        <CardContent className="px-0 md:px-2 py-4">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            {/* Sticky Tabs Header */}
            <div className={cn(
              "sticky top-0 z-20 bg-background pb-2 px-2",
              !onClose && "static"
            )}>
              <TabsList className="grid w-full grid-cols-2 h-10">
                <TabsTrigger value="front9" className="text-sm">Front 9</TabsTrigger>
                <TabsTrigger value="back9" className="text-sm">Back 9</TabsTrigger>
              </TabsList>
            </div>
            
            <TabsContent value="front9" className="mt-4">
              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-xs lg:text-sm">
                  <thead>
                    {/* Par Row */}
                    <tr className="border-b bg-muted/20">
                      <th className="text-left p-1 lg:p-2 text-xs lg:text-sm font-medium text-muted-foreground">PAR</th>
                      {front9Holes.map(hole => (
                        <th key={hole} className="text-center p-1 lg:p-2 text-xs lg:text-sm font-medium w-7 lg:w-10 text-muted-foreground">
                          {matchData?.hole_pars?.[String(hole)] || 4}
                        </th>
                      ))}
                      <th className="text-center p-1 lg:p-2 text-xs lg:text-sm font-medium bg-accent/20 text-muted-foreground">Total</th>
                    </tr>
                    {/* Yardage Row - only if tee_data available */}
                    {matchData?.tee_data?.holes && (
                      <tr className="border-b bg-muted/10">
                        <th className="text-left p-1 lg:p-2 text-[10px] lg:text-xs font-medium text-muted-foreground">YDS</th>
                        {front9Holes.map(hole => (
                          <th key={hole} className="text-center p-1 lg:p-2 text-[10px] lg:text-xs font-normal w-7 lg:w-10 text-muted-foreground">
                            {matchData.tee_data?.holes?.[String(hole)]?.yardage || '—'}
                          </th>
                        ))}
                        <th className="text-center p-1 lg:p-2 text-[10px] lg:text-xs font-normal text-muted-foreground">
                          {front9Holes.reduce((sum, h) => sum + (matchData.tee_data?.holes?.[String(h)]?.yardage || 0), 0)}
                        </th>
                      </tr>
                    )}
                    {/* Hole Numbers Row */}
                    <tr className="border-b">
                      <th className="text-left p-1 lg:p-2 text-xs lg:text-sm font-medium">
                        <div className="flex items-center gap-1 lg:gap-2">
                          <span>Player</span>
                          <span className="text-muted-foreground">|</span>
                          <span className="text-muted-foreground">Hole</span>
                        </div>
                      </th>
                      {front9Holes.map(hole => (
                        <th key={hole} className="text-center p-1 lg:p-2 text-xs lg:text-sm font-medium w-7 lg:w-10">
                          {hole}
                        </th>
                      ))}
                      <th className="text-center p-1 lg:p-2 text-xs lg:text-sm font-medium bg-muted">Strokes</th>
                      <th className="text-center p-1 lg:p-2 text-xs lg:text-sm font-medium bg-accent/20">vs Par</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Current User Row */}
                    {currentUserScore && (
                      <tr className="border-b bg-primary/5">
                        <td className="p-1 lg:p-2 text-xs lg:text-sm font-medium">
                          <div className="flex items-center gap-1 lg:gap-2">
                            <div className="w-1.5 h-1.5 lg:w-2 lg:h-2 rounded-full bg-primary"></div>
                            <span className="truncate max-w-[60px] lg:max-w-none">{currentUserScore.player_name}</span>
                            <Badge variant="default" className="text-[10px] lg:text-xs bg-primary px-1 lg:px-2">You</Badge>
                          </div>
                        </td>
                        {/* Front 9 holes */}
                        {front9Holes.map(hole => {
                          const score = currentUserScore.scores[hole];
                          const isEditing = editingHole === hole;
                          
                          // Find the active hole (first hole after last scored hole)
                          const completedHoles = Array.from({ length: 9 }, (_, j) => j + 1)
                            .filter(h => currentUserScore.scores[h]);
                          const lastCompletedHole = completedHoles.length > 0 ? Math.max(...completedHoles) : 0;
                          const isActiveHole = hole === lastCompletedHole + 1 && !score;

                          return (
                            <td key={hole} className="text-center p-0.5">
                              <Button
                                variant={score ? "default" : "outline"}
                                size="sm"
                                className={cn(
                                  "w-7 h-7 lg:w-9 lg:h-9 p-0 text-xs lg:text-sm font-semibold transition-all touch-none",
                                  score 
                                    ? "bg-primary text-primary-foreground hover:bg-primary/90" 
                                    : isActiveHole
                                    ? "border-2 border-primary bg-primary/20 hover:bg-primary/30 animate-pulse"
                                    : "border-dashed hover:border-primary hover:bg-primary/10"
                                )}
                                onClick={() => handleScoreEdit(hole, score)}
                                disabled={saving || readOnly || matchData?.status === 'cancelled' || matchData?.status === 'completed'}
                              >
                                {score || '+'}
                              </Button>
                            </td>
                          );
                        })}
                        
                        {/* Front 9 Strokes */}
                        <td className="text-center p-1">
                          <div className="bg-muted text-muted-foreground rounded-lg px-1.5 py-1 lg:px-2 lg:py-1.5 font-bold text-xs lg:text-sm">
                            {currentUserScore.front9 || 0}
                          </div>
                        </td>
                        
                        {/* Front 9 vs Par */}
                        <td className="text-center p-1">
                          <div className="bg-accent text-accent-foreground rounded-lg px-1.5 py-1 lg:px-2 lg:py-1.5 font-bold text-xs lg:text-sm">
                            {(() => {
                              // Only calculate for completed holes
                              const completedHoles = Array.from({ length: 9 }, (_, i) => i + 1)
                                .filter(hole => currentUserScore.scores[hole]);
                              
                              if (completedHoles.length === 0) return '—';
                              
                              const completedPar = completedHoles.reduce((sum, hole) => 
                                sum + (matchData?.hole_pars?.[String(hole)] || 4), 0);
                              const completedStrokes = completedHoles.reduce((sum, hole) => 
                                sum + (currentUserScore.scores[hole] || 0), 0);
                              const scoreDiff = completedStrokes - completedPar;
                              
                              if (scoreDiff === 0) return 'E';
                              return scoreDiff > 0 ? `+${scoreDiff}` : `${scoreDiff}`;
                            })()}
                          </div>
                        </td>
                      </tr>
                    )}

                    {/* Other Players Rows */}
                    {otherPlayers.map((player) => (
                      <tr key={player.player_id} className="border-b hover:bg-muted/10">
                        <td className="p-1 lg:p-2 text-xs lg:text-sm font-medium">
                          <div className="flex items-center gap-1 lg:gap-2">
                            <div className="w-1.5 h-1.5 lg:w-2 lg:h-2 rounded-full bg-muted-foreground"></div>
                            <span className="truncate max-w-[60px] lg:max-w-none">{player.player_name}</span>
                          </div>
                        </td>
                        {/* Front 9 holes */}
                        {front9Holes.map(hole => {
                          const score = player.scores[hole];

                          return (
                            <td key={hole} className="text-center p-0.5">
                              <div className={cn(
                                "w-7 h-7 lg:w-9 lg:h-9 rounded-lg flex items-center justify-center text-xs lg:text-sm font-medium transition-all",
                                score 
                                  ? 'bg-muted text-foreground border-2 border-border' 
                                  : 'bg-muted/30 border-2 border-dashed border-border/50 text-muted-foreground'
                              )}>
                                {score || '—'}
                              </div>
                            </td>
                          );
                        })}
                        {/* Front 9 Strokes */}
                        <td className="text-center p-1">
                          <div className="bg-muted text-muted-foreground rounded-lg px-1.5 py-1 lg:px-2 lg:py-1.5 font-bold text-xs lg:text-sm">
                            {player.front9 || 0}
                          </div>
                        </td>
                        
                        {/* Front 9 vs Par */}
                        <td className="text-center p-1">
                          <div className="bg-accent text-accent-foreground rounded-lg px-1.5 py-1 lg:px-2 lg:py-1.5 font-bold text-xs lg:text-sm">
                            {(() => {
                              // Only calculate for completed holes
                              const completedHoles = Array.from({ length: 9 }, (_, i) => i + 1)
                                .filter(hole => player.scores[hole]);
                              
                              if (completedHoles.length === 0) return '—';
                              
                              const completedPar = completedHoles.reduce((sum, hole) => 
                                sum + (matchData?.hole_pars?.[String(hole)] || 4), 0);
                              const completedStrokes = completedHoles.reduce((sum, hole) => 
                                sum + (player.scores[hole] || 0), 0);
                              const scoreDiff = completedStrokes - completedPar;
                              
                              if (scoreDiff === 0) return 'E';
                              return scoreDiff > 0 ? `+${scoreDiff}` : `${scoreDiff}`;
                            })()}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Vertical View */}
              <div className="md:hidden">
                {/* Front 9 Total Card - Sticky below tabs */}
                <div className="sticky top-[56px] z-10 bg-background pb-4 px-2">
                  <Card className="bg-accent/10 border-accent">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-semibold text-accent-foreground">Front 9</h3>
                          <div className="text-sm text-muted-foreground">
                            {Object.keys(currentUserScore?.scores || {}).filter(h => parseInt(h) <= 9).length}/9 holes
                          </div>
                          {matchData?.tee_data?.holes && (
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {Array.from({ length: 9 }, (_, i) => i + 1)
                                .reduce((sum, hole) => sum + (matchData.tee_data?.holes?.[String(hole)]?.yardage || 0), 0)
                                .toLocaleString()} yds
                            </div>
                          )}
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold text-accent-foreground">{currentUserScore?.front9 || 0}</div>
                          <div className="text-sm font-semibold text-accent-foreground">
                            {(() => {
                              const completedHoles = Array.from({ length: 9 }, (_, i) => i + 1)
                                .filter(hole => currentUserScore?.scores[hole]);
                              
                              if (completedHoles.length === 0) return '—';
                              
                              const completedPar = completedHoles.reduce((sum, hole) => 
                                sum + (matchData?.hole_pars?.[String(hole)] || 4), 0);
                              const completedStrokes = completedHoles.reduce((sum, hole) => 
                                sum + (currentUserScore?.scores[hole] || 0), 0);
                              const scoreDiff = completedStrokes - completedPar;
                              
                              if (scoreDiff === 0) return 'E';
                              return scoreDiff > 0 ? `+${scoreDiff}` : `${scoreDiff}`;
                            })()}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Holes 1-9 */}
                <div className="space-y-4 px-2">
                {front9Holes.map(hole => {
                  const par = matchData?.hole_pars?.[String(hole)] || 4;
                  const currentScore = currentUserScore?.scores[hole];
                  
                  // Find the active hole (first hole after last scored hole)
                  const completedHoles = Array.from({ length: 9 }, (_, j) => j + 1)
                    .filter(h => currentUserScore?.scores[h]);
                  const lastCompletedHole = completedHoles.length > 0 ? Math.max(...completedHoles) : 0;
                  const isActiveHole = hole === lastCompletedHole + 1 && !currentScore;
                  const isPlayedHole = currentScore !== undefined;
                  
                  return (
                    <Card 
                      key={hole} 
                      ref={isActiveHole ? activeHoleRef : null}
                      className={cn(
                        "w-full touch-auto",
                        isActiveHole && "border-2 border-primary bg-primary/5"
                      )}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              "w-8 h-8 rounded-full flex items-center justify-center font-bold",
                              isActiveHole ? "bg-primary text-primary-foreground animate-pulse" : "bg-primary/20 text-primary"
                            )}>
                              {hole}
                            </div>
                            <div>
                              <div className="font-semibold">Hole {hole}</div>
                              <div className="text-sm text-muted-foreground">
                                Par {par}
                                {matchData?.tee_data?.holes?.[String(hole)] && (
                                  <span className="ml-2">• {matchData.tee_data.holes[String(hole)].yardage} yds</span>
                                )}
                              </div>
                              {matchData?.tee_data?.holes?.[String(hole)]?.handicap !== undefined && (
                                <div className="text-xs text-muted-foreground">HCP {matchData.tee_data.holes[String(hole)].handicap}</div>
                              )}
                            </div>
                          </div>
                          <Button
                            variant={currentScore ? "default" : "outline"}
                            size="lg"
                            className={cn(
                              "w-16 h-16 text-xl font-bold transition-all touch-auto",
                              currentScore 
                                ? "bg-primary text-primary-foreground hover:bg-primary/90" 
                                : isActiveHole
                                ? "border-2 border-primary bg-primary/20 hover:bg-primary/30 animate-pulse"
                                : "border-dashed hover:border-primary hover:bg-primary/10"
                            )}
                            onClick={() => handleScoreEdit(hole, currentScore)}
                            disabled={saving || readOnly || matchData?.status === 'cancelled' || matchData?.status === 'completed'}
                          >
                            {currentScore || '+'}
                          </Button>
                        </div>
                        
                        {/* Other players' scores for this hole */}
                        {otherPlayers.length > 0 && (
                          <Collapsible 
                            open={expandedOtherPlayers[hole] || false}
                            onOpenChange={() => toggleOtherPlayers(hole)}
                            className="pt-3 border-t"
                          >
                            <CollapsibleTrigger asChild>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="w-full flex items-center justify-between text-muted-foreground hover:text-foreground"
                              >
                                <span className="text-sm font-medium">Other Players</span>
                                <ChevronDown className={cn(
                                  "h-4 w-4 transition-transform",
                                  expandedOtherPlayers[hole] && "rotate-180"
                                )} />
                              </Button>
                            </CollapsibleTrigger>
                             <CollapsibleContent className="pt-2">
                              <div className="flex flex-wrap gap-2">
                                {otherPlayers.map((player) => (
                                  <div key={player.player_id} className="flex items-center gap-2 bg-muted/20 rounded-lg px-3 py-1 min-w-0">
                                    <span className="text-sm font-medium truncate max-w-[120px]">{player.player_name}</span>
                                    <div className="w-8 h-8 rounded bg-muted text-muted-foreground flex items-center justify-center text-sm font-medium flex-shrink-0">
                                      {player.scores[hole] || '—'}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </CollapsibleContent>
                          </Collapsible>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="back9" className="mt-4">
              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-xs lg:text-sm">
                  <thead>
                    {/* Par Row */}
                    <tr className="border-b bg-muted/20">
                      <th className="text-left p-1 lg:p-2 text-xs lg:text-sm font-medium text-muted-foreground">PAR</th>
                      {back9Holes.map(hole => (
                        <th key={hole} className="text-center p-1 lg:p-2 text-xs lg:text-sm font-medium w-7 lg:w-10 text-muted-foreground">
                          {matchData?.hole_pars?.[String(hole)] || 4}
                        </th>
                      ))}
                      <th className="text-center p-1 lg:p-2 text-xs lg:text-sm font-medium bg-accent/20 text-muted-foreground">Total</th>
                    </tr>
                    {/* Yardage Row - only if tee_data available */}
                    {matchData?.tee_data?.holes && (
                      <tr className="border-b bg-muted/10">
                        <th className="text-left p-1 lg:p-2 text-[10px] lg:text-xs font-medium text-muted-foreground">YDS</th>
                        {back9Holes.map(hole => (
                          <th key={hole} className="text-center p-1 lg:p-2 text-[10px] lg:text-xs font-normal w-7 lg:w-10 text-muted-foreground">
                            {matchData.tee_data?.holes?.[String(hole)]?.yardage || '—'}
                          </th>
                        ))}
                        <th className="text-center p-1 lg:p-2 text-[10px] lg:text-xs font-normal text-muted-foreground">
                          {back9Holes.reduce((sum, h) => sum + (matchData.tee_data?.holes?.[String(h)]?.yardage || 0), 0)}
                        </th>
                      </tr>
                    )}
                    {/* Hole Numbers Row */}
                    <tr className="border-b">
                      <th className="text-left p-1 lg:p-2 text-xs lg:text-sm font-medium">
                        <div className="flex items-center gap-1 lg:gap-2">
                          <span>Player</span>
                          <span className="text-muted-foreground">|</span>
                          <span className="text-muted-foreground">Hole</span>
                        </div>
                      </th>
                      {back9Holes.map(hole => (
                        <th key={hole} className="text-center p-1 lg:p-2 text-xs lg:text-sm font-medium w-7 lg:w-10">
                          {hole}
                        </th>
                      ))}
                      <th className="text-center p-1 lg:p-2 text-xs lg:text-sm font-medium bg-muted">Strokes</th>
                      <th className="text-center p-1 lg:p-2 text-xs lg:text-sm font-medium bg-accent/20">vs Par</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Current User Row */}
                    {currentUserScore && (
                      <tr className="border-b bg-primary/5">
                        <td className="p-1 lg:p-2 text-xs lg:text-sm font-medium">
                          <div className="flex items-center gap-1 lg:gap-2">
                            <div className="w-1.5 h-1.5 lg:w-2 lg:h-2 rounded-full bg-primary"></div>
                            <span className="truncate max-w-[60px] lg:max-w-none">{currentUserScore.player_name}</span>
                            <Badge variant="default" className="text-[10px] lg:text-xs bg-primary px-1 lg:px-2">You</Badge>
                          </div>
                        </td>
                        {/* Back 9 holes */}
                        {back9Holes.map(hole => {
                          const score = currentUserScore.scores[hole];
                          
                          // Find the active hole (first hole after last scored hole)
                          const completedHoles = Array.from({ length: 9 }, (_, j) => j + 10)
                            .filter(h => currentUserScore.scores[h]);
                          const lastCompletedHole = completedHoles.length > 0 ? Math.max(...completedHoles) : 9;
                          const isActiveHole = hole === lastCompletedHole + 1 && !score;

                          return (
                            <td key={hole} className="text-center p-0.5">
                              <Button
                                variant={score ? "default" : "outline"}
                                size="sm"
                                className={cn(
                                  "w-7 h-7 lg:w-9 lg:h-9 p-0 text-xs lg:text-sm font-semibold transition-all touch-none",
                                  score 
                                    ? "bg-primary text-primary-foreground hover:bg-primary/90" 
                                    : isActiveHole
                                    ? "border-2 border-primary bg-primary/20 hover:bg-primary/30 animate-pulse"
                                    : "border-dashed hover:border-primary hover:bg-primary/10"
                                )}
                                onClick={() => handleScoreEdit(hole, score)}
                                disabled={saving || readOnly || matchData?.status === 'cancelled' || matchData?.status === 'completed'}
                              >
                                {score || '+'}
                              </Button>
                            </td>
                          );
                        })}
                        
                        {/* Back 9 Strokes */}
                        <td className="text-center p-1">
                          <div className="bg-muted text-muted-foreground rounded-lg px-1.5 py-1 lg:px-2 lg:py-1.5 font-bold text-xs lg:text-sm">
                            {currentUserScore.back9 || 0}
                          </div>
                        </td>
                        
                        {/* Back 9 vs Par */}
                        <td className="text-center p-1">
                          <div className="bg-accent text-accent-foreground rounded-lg px-1.5 py-1 lg:px-2 lg:py-1.5 font-bold text-xs lg:text-sm">
                            {(() => {
                              // Only calculate for completed holes
                              const completedHoles = Array.from({ length: 9 }, (_, i) => i + 10)
                                .filter(hole => currentUserScore.scores[hole]);
                              
                              if (completedHoles.length === 0) return '—';
                              
                              const completedPar = completedHoles.reduce((sum, hole) => 
                                sum + (matchData?.hole_pars?.[String(hole)] || 4), 0);
                              const completedStrokes = completedHoles.reduce((sum, hole) => 
                                sum + (currentUserScore.scores[hole] || 0), 0);
                              const scoreDiff = completedStrokes - completedPar;
                              
                              if (scoreDiff === 0) return 'E';
                              return scoreDiff > 0 ? `+${scoreDiff}` : `${scoreDiff}`;
                            })()}
                          </div>
                        </td>
                      </tr>
                    )}

                    {/* Other Players Rows */}
                    {otherPlayers.map((player) => (
                      <tr key={player.player_id} className="border-b hover:bg-muted/10">
                        <td className="p-1 lg:p-2 text-xs lg:text-sm font-medium">
                          <div className="flex items-center gap-1 lg:gap-2">
                            <div className="w-1.5 h-1.5 lg:w-2 lg:h-2 rounded-full bg-muted-foreground"></div>
                            <span className="truncate max-w-[60px] lg:max-w-none">{player.player_name}</span>
                          </div>
                        </td>
                        {/* Back 9 holes */}
                        {back9Holes.map(hole => {
                          const score = player.scores[hole];

                          return (
                            <td key={hole} className="text-center p-0.5">
                              <div className={cn(
                                "w-7 h-7 lg:w-9 lg:h-9 rounded-lg flex items-center justify-center text-xs lg:text-sm font-medium transition-all",
                                score 
                                  ? 'bg-muted text-foreground border-2 border-border' 
                                  : 'bg-muted/30 border-2 border-dashed border-border/50 text-muted-foreground'
                              )}>
                                {score || '—'}
                              </div>
                            </td>
                          );
                        })}
                        {/* Back 9 Strokes */}
                        <td className="text-center p-1">
                          <div className="bg-muted text-muted-foreground rounded-lg px-1.5 py-1 lg:px-2 lg:py-1.5 font-bold text-xs lg:text-sm">
                            {player.back9 || 0}
                          </div>
                        </td>
                        
                        {/* Back 9 vs Par */}
                        <td className="text-center p-1">
                          <div className="bg-accent text-accent-foreground rounded-lg px-1.5 py-1 lg:px-2 lg:py-1.5 font-bold text-xs lg:text-sm">
                            {(() => {
                              // Only calculate for completed holes
                              const completedHoles = Array.from({ length: 9 }, (_, i) => i + 10)
                                .filter(hole => player.scores[hole]);
                              
                              if (completedHoles.length === 0) return '—';
                              
                              const completedPar = completedHoles.reduce((sum, hole) => 
                                sum + (matchData?.hole_pars?.[String(hole)] || 4), 0);
                              const completedStrokes = completedHoles.reduce((sum, hole) => 
                                sum + (player.scores[hole] || 0), 0);
                              const scoreDiff = completedStrokes - completedPar;
                              
                              if (scoreDiff === 0) return 'E';
                              return scoreDiff > 0 ? `+${scoreDiff}` : `${scoreDiff}`;
                            })()}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Vertical View */}
              <div className="md:hidden">
                {/* Back 9 Total Card - Sticky below tabs */}
                <div className="sticky top-[56px] z-10 bg-background pb-4 px-2">
                  <Card className="bg-accent/10 border-accent">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-semibold text-accent-foreground">Back 9</h3>
                          <div className="text-sm text-muted-foreground">
                            {Object.keys(currentUserScore?.scores || {}).filter(h => parseInt(h) >= 10).length}/9 holes
                          </div>
                          {matchData?.tee_data?.holes && (
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {Array.from({ length: 9 }, (_, i) => i + 10)
                                .reduce((sum, hole) => sum + (matchData.tee_data?.holes?.[String(hole)]?.yardage || 0), 0)
                                .toLocaleString()} yds
                            </div>
                          )}
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold text-accent-foreground">{currentUserScore?.back9 || 0}</div>
                          <div className="text-sm font-semibold text-accent-foreground">
                            {(() => {
                              const completedHoles = Array.from({ length: 9 }, (_, i) => i + 10)
                                .filter(hole => currentUserScore?.scores[hole]);
                              
                              if (completedHoles.length === 0) return '—';
                              
                              const completedPar = completedHoles.reduce((sum, hole) => 
                                sum + (matchData?.hole_pars?.[String(hole)] || 4), 0);
                              const completedStrokes = completedHoles.reduce((sum, hole) => 
                                sum + (currentUserScore?.scores[hole] || 0), 0);
                              const scoreDiff = completedStrokes - completedPar;
                              
                              if (scoreDiff === 0) return 'E';
                              return scoreDiff > 0 ? `+${scoreDiff}` : `${scoreDiff}`;
                            })()}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Holes 10-18 */}
                <div className="space-y-4 px-2">
                {back9Holes.map(hole => {
                  const par = matchData?.hole_pars?.[String(hole)] || 4;
                  const currentScore = currentUserScore?.scores[hole];
                  
                  // Find the active hole (first hole after last scored hole)
                  const completedHoles = Array.from({ length: 9 }, (_, j) => j + 10)
                    .filter(h => currentUserScore?.scores[h]);
                  const lastCompletedHole = completedHoles.length > 0 ? Math.max(...completedHoles) : 9;
                  const isActiveHole = hole === lastCompletedHole + 1 && !currentScore;
                  const isPlayedHole = currentScore !== undefined;
                  
                  return (
                    <Card 
                      key={hole} 
                      ref={isActiveHole ? activeHoleRef : null}
                      className={cn(
                        "w-full touch-auto",
                        isActiveHole && "border-2 border-primary bg-primary/5"
                      )}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              "w-8 h-8 rounded-full flex items-center justify-center font-bold",
                              isActiveHole ? "bg-primary text-primary-foreground animate-pulse" : "bg-primary/20 text-primary"
                            )}>
                              {hole}
                            </div>
                            <div>
                              <div className="font-semibold">Hole {hole}</div>
                              <div className="text-sm text-muted-foreground">
                                Par {par}
                                {matchData?.tee_data?.holes?.[String(hole)] && (
                                  <span className="ml-2">• {matchData.tee_data.holes[String(hole)].yardage} yds</span>
                                )}
                              </div>
                              {matchData?.tee_data?.holes?.[String(hole)]?.handicap !== undefined && (
                                <div className="text-xs text-muted-foreground">HCP {matchData.tee_data.holes[String(hole)].handicap}</div>
                              )}
                            </div>
                          </div>
                          <Button
                            variant={currentScore ? "default" : "outline"}
                            size="lg"
                            className={cn(
                              "w-16 h-16 text-xl font-bold transition-all touch-auto",
                              currentScore 
                                ? "bg-primary text-primary-foreground hover:bg-primary/90" 
                                : isActiveHole
                                ? "border-2 border-primary bg-primary/20 hover:bg-primary/30 animate-pulse"
                                : "border-dashed hover:border-primary hover:bg-primary/10"
                            )}
                            onClick={() => handleScoreEdit(hole, currentScore)}
                            disabled={saving || readOnly || matchData?.status === 'cancelled' || matchData?.status === 'completed'}
                          >
                            {currentScore || '+'}
                          </Button>
                        </div>
                        
                        {/* Other players' scores for this hole */}
                        {otherPlayers.length > 0 && (
                          <Collapsible 
                            open={expandedOtherPlayers[hole] || false}
                            onOpenChange={() => toggleOtherPlayers(hole)}
                            className="pt-3 border-t"
                          >
                            <CollapsibleTrigger asChild>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="w-full flex items-center justify-between text-muted-foreground hover:text-foreground"
                              >
                                <span className="text-sm font-medium">Other Players</span>
                                <ChevronDown className={cn(
                                  "h-4 w-4 transition-transform",
                                  expandedOtherPlayers[hole] && "rotate-180"
                                )} />
                              </Button>
                            </CollapsibleTrigger>
                            <CollapsibleContent className="pt-2">
                              <div className="flex flex-wrap gap-2">
                                {otherPlayers.map((player) => (
                                  <div key={player.player_id} className="flex items-center gap-2 bg-muted/20 rounded-lg px-3 py-1 min-w-0">
                                    <span className="text-sm font-medium truncate max-w-[120px]">{player.player_name}</span>
                                    <div className="w-8 h-8 rounded bg-muted text-muted-foreground flex items-center justify-center text-sm font-medium flex-shrink-0">
                                      {player.scores[hole] || '—'}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </CollapsibleContent>
                          </Collapsible>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
      )}

      {/* Action Buttons - Bottom */}
      {!matchResult && isMatchComplete && canFinalize && (
        <div className="flex flex-col items-center gap-4 px-6 pb-8 pt-6">
          <div className="text-center">
            <p className="text-sm text-muted-foreground">
              {confirmations.filter(c => c.confirmed).length} of {confirmations.length} players confirmed
            </p>
          </div>
          <Button
            onClick={handleFinalize}
            disabled={saving || confirmations.find(c => c.player_id === user?.id)?.confirmed}
            size="lg"
            className="bg-gradient-primary text-primary-foreground hover:shadow-premium text-base"
          >
            <Trophy className="w-5 h-5 mr-2" />
            {confirmations.find(c => c.player_id === user?.id)?.confirmed 
              ? "Waiting for others..." 
              : saving ? "Confirming..." : "Confirm Results"}
          </Button>
        </div>
      )}

      {!matchResult && !isMatchComplete && matchData?.status !== 'cancelled' && (
        <div className="text-center text-muted-foreground px-6 pb-8">
          <Clock className="w-5 h-5 mx-auto mb-2" />
          <p>Complete all 18 holes to finalize results</p>
        </div>
      )}

      {/* Score Entry Dialog */}
      <Dialog open={scoreDialogOpen} onOpenChange={setScoreDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Target className="w-5 h-5 text-primary" />
              Hole {editingHole} Score
            </DialogTitle>
            <DialogDescription>
              Enter your stroke count for hole {editingHole}
              {matchData?.hole_pars?.[String(editingHole)] && (
                <span className="block mt-1 font-medium">
                  Par {matchData.hole_pars[String(editingHole)]}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* Manual Input - Hidden on mobile */}
            <div className="hidden md:block space-y-2">
              <label className="text-sm font-medium">Manual Entry</label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  min="1"
                  max="10"
                  value={tempScore}
                  onChange={(e) => setTempScore(e.target.value)}
                  className="text-center text-lg h-12"
                  placeholder="1-10"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleScoreSave();
                    if (e.key === 'Escape') handleScoreCancel();
                  }}
                />
                <Button 
                  onClick={handleScoreSave} 
                  disabled={!tempScore || saving}
                  className="h-12 px-6"
                >
                  Save
                </Button>
              </div>
            </div>
            
            {/* Quick Entry Buttons */}
            <div className="space-y-2">
              <label className="hidden md:block text-sm font-medium">Quick Entry</label>
              <div className="grid grid-cols-5 gap-2">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((score) => (
                  <Button
                    key={score}
                    variant="outline"
                    size="lg"
                    className="h-12 text-lg font-semibold hover:bg-primary hover:text-primary-foreground transition-colors"
                    onClick={() => handleQuickScore(score)}
                    disabled={saving}
                  >
                    {score}
                  </Button>
                ))}
              </div>
            </div>
            
            <div className="flex gap-2 pt-4">
              <Button 
                variant="outline" 
                onClick={handleScoreCancel}
                className="flex-1 h-12"
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Cancel Match Dialog */}
      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" />
              Leave Match
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>Please select a reason for leaving this match. This action cannot be undone.</p>
              {(() => {
                const weatherOrCourseReasons = ['lightning', 'rain', 'temperature', 'course-closure', 'wildlife'];
                const isWeatherOrCourse = cancelReason && weatherOrCourseReasons.includes(cancelReason);
                const otherPlayersCount = playerScores.filter(p => p.player_id !== user?.id).length;
                
                return (
                  <div className={cn(
                    "rounded-lg p-4 space-y-2 border text-left",
                    isWeatherOrCourse 
                      ? "bg-blue-500/10 border-blue-500/30" 
                      : "bg-destructive/10 border-destructive/30"
                  )}>
                    <p className={cn(
                      "font-semibold text-sm flex items-center gap-2",
                      isWeatherOrCourse ? "text-blue-600 dark:text-blue-400" : "text-destructive"
                    )}>
                      <AlertTriangle className="w-4 h-4" />
                      {isWeatherOrCourse ? "Weather/Course Cancellation" : "Important: By leaving this match"}
                    </p>
                    <ul className="text-sm space-y-1 pl-6 list-disc text-foreground text-left">
                      {isWeatherOrCourse ? (
                        <>
                          <li>Your buy-in will be <strong>refunded minus $2 cancellation fee</strong> ({formatBuyIn(matchData?.buy_in_amount)} - $2.00)</li>
                          {otherPlayersCount >= 2 ? (
                            <li>You will be marked as <strong>DNF</strong> and the match will continue</li>
                          ) : (
                            <li>The match will be <strong>cancelled</strong> and all players will receive refunds minus $2 cancellation fee</li>
                          )}
                        </>
                      ) : (
                        <>
                          <li>You will <strong>forfeit your buy-in amount</strong> ({formatBuyIn(matchData?.buy_in_amount)})</li>
                          <li>You will <strong>not be eligible for any payouts</strong></li>
                          {otherPlayersCount >= 2 ? (
                            <li>You will be marked as <strong>DNF (Did Not Finish)</strong> and the match will continue</li>
                          ) : (
                            <li>The match will be <strong>cancelled</strong> and all players will receive refunds minus a <strong>$2 cancellation fee</strong></li>
                          )}
                        </>
                      )}
                    </ul>
                  </div>
                );
              })()}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-4 py-4">
            <RadioGroup value={cancelReason} onValueChange={setCancelReason}>
              {/* Player-Related */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-foreground">🩺 Player-Related</h4>
                <div className="space-y-2 pl-6">
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="injury" id="injury" />
                    <Label htmlFor="injury" className="cursor-pointer">Injury or sudden pain</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="medical" id="medical" />
                    <Label htmlFor="medical" className="cursor-pointer">Medical emergency or illness</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="mental" id="mental" />
                    <Label htmlFor="mental" className="cursor-pointer">Mental or emotional distress</Label>
                  </div>
                </div>
              </div>

              {/* Weather-Related */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-foreground">🌦️ Weather-Related</h4>
                <div className="space-y-2 pl-6">
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="lightning" id="lightning" />
                    <Label htmlFor="lightning" className="cursor-pointer">Lightning or dangerous storms</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="rain" id="rain" />
                    <Label htmlFor="rain" className="cursor-pointer">Heavy rain or flooding</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="temperature" id="temperature" />
                    <Label htmlFor="temperature" className="cursor-pointer">Extreme heat or cold</Label>
                  </div>
                </div>
              </div>

              {/* Course or Equipment-Related */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-foreground">⛳ Course or Equipment-Related</h4>
                <div className="space-y-2 pl-6">
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="course-closure" id="course-closure" />
                    <Label htmlFor="course-closure" className="cursor-pointer">Course closure or suspension of play</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="equipment" id="equipment" />
                    <Label htmlFor="equipment" className="cursor-pointer">Equipment failure</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="wildlife" id="wildlife" />
                    <Label htmlFor="wildlife" className="cursor-pointer">Dangerous wildlife or terrain</Label>
                  </div>
                </div>
              </div>

              {/* Group or Match-Play Related */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-foreground">👥 Group or Match-Play Related</h4>
                <div className="space-y-2 pl-6">
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="withdrawal" id="withdrawal" />
                    <Label htmlFor="withdrawal" className="cursor-pointer">Opponent or partner withdrawal</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="unsafe-play" id="unsafe-play" />
                    <Label htmlFor="unsafe-play" className="cursor-pointer">Unsafe or disruptive play by others</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="emergency-call" id="emergency-call" />
                    <Label htmlFor="emergency-call" className="cursor-pointer">Personal or family emergency call</Label>
                  </div>
                </div>
              </div>
            </RadioGroup>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={isLeaving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancelMatch}
              disabled={!cancelReason || isLeaving}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isLeaving ? 'Leaving...' : 'Leave Match'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Leave Match Button - Desktop Only - Bottom Right */}
      {!matchResult && !loading && matchData?.status !== 'cancelled' && (
        <div className="hidden md:flex justify-end px-4 md:px-6 pb-4">
          <Button
            onClick={() => setCancelDialogOpen(true)}
            className="bg-gradient-accent text-accent-foreground hover:shadow-premium transition-all duration-300"
          >
            <AlertTriangle className="w-4 h-4 mr-2" />
            Leave Match
          </Button>
        </div>
      )}

      {/* Cancellation Confirmation Dialogs */}
      {pendingConfirmations.length > 0 && (
        <CancellationConfirmationDialog
          confirmation={pendingConfirmations[currentConfirmationIndex]}
          open={true}
          onOpenChange={(open) => {
            if (!open && currentConfirmationIndex < pendingConfirmations.length - 1) {
              setCurrentConfirmationIndex(prev => prev + 1);
            }
          }}
          onConfirm={async (confirmed, alternateReason) => {
            await confirmCancellation(
              pendingConfirmations[currentConfirmationIndex].id,
              confirmed,
              alternateReason
            );
            
            if (currentConfirmationIndex < pendingConfirmations.length - 1) {
              setCurrentConfirmationIndex(prev => prev + 1);
            } else {
              setCurrentConfirmationIndex(0);
            }
          }}
        />
      )}

      {/* Double Down Dialog */}
      <AlertDialog open={doubleDownDialogOpen} onOpenChange={setDoubleDownDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              🎲 Double Down on the Back 9?
            </AlertDialogTitle>
            <AlertDialogDescription>
              <div className="space-y-4 text-left">
                <p>All players must agree to double the stakes for the back 9!</p>
                
                <div className="bg-muted p-3 rounded-lg space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Original Buy-in:</span>
                    <span className="font-semibold">${((matchData?.buy_in_amount || 0) / 100).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Additional Buy-in:</span>
                    <span className="font-semibold">${((matchData?.double_down_amount || matchData?.buy_in_amount || 0) / 100).toFixed(2)}</span>
                  </div>
                  <div className="border-t pt-2 flex justify-between font-bold">
                    <span>New Total:</span>
                    <span>${(((matchData?.buy_in_amount || 0) + (matchData?.double_down_amount || matchData?.buy_in_amount || 0)) / 100).toFixed(2)}</span>
                  </div>
                </div>

                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-3 rounded-lg">
                  <p className="text-sm text-amber-800 dark:text-amber-200">
                    ⚠️ Payment will only be processed if <strong>ALL</strong> players agree
                  </p>
                </div>

                {doubleDownStatuses.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold">Player Status:</h4>
                    <div className="space-y-1">
                      {playerScores.map(player => {
                        const status = doubleDownStatuses.find(s => s.user_id === player.player_id);
                        const isCurrentUser = player.player_id === user?.id;
                        
                        return (
                          <div key={player.player_id} className="flex items-center justify-between text-sm">
                            <span className={isCurrentUser ? "font-semibold" : ""}>
                              {player.player_name}{isCurrentUser && " (You)"}
                            </span>
                            {status?.responded ? (
                              status.opted_in ? (
                                <span className="text-green-600 dark:text-green-400 flex items-center gap-1">
                                  <Check className="h-3 w-3" /> Agreed
                                </span>
                              ) : (
                                <span className="text-red-600 dark:text-red-400">Declined</span>
                              )
                            ) : (
                              <span className="text-muted-foreground">Waiting...</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => handleDoubleDownVote(false)} disabled={isProcessingDoubleDown}>
              Opt Out
            </AlertDialogCancel>
            <Button 
              onClick={() => handleDoubleDownVote(true)} 
              disabled={isProcessingDoubleDown}
              className="bg-amber-500 hover:bg-amber-600 text-white"
            >
              {isProcessingDoubleDown ? "Processing..." : "Double Down 🎲"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Player Rating Dialog */}
      <PlayerRatingDialog
        open={ratingDialogOpen}
        onOpenChange={setRatingDialogOpen}
        matchId={matchId}
        matchName={matchData?.course_name || matchName}
      />
    </div>
  );
}
