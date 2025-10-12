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
import { Target, Trophy, Clock, CheckCircle, Users, ChevronDown, DollarSign, Menu, X, Check, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MatchResultsDisplay } from './MatchResultsDisplay';
import { CancellationConfirmationDialog } from './CancellationConfirmationDialog';
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
    isMatchComplete,
    canFinalize
  } = useMatchScoring(matchId);

  const [editingHole, setEditingHole] = useState<number | null>(null);
  const [tempScore, setTempScore] = useState<string>('');
  const [scoreDialogOpen, setScoreDialogOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(typeof window !== 'undefined' && window.innerWidth >= 768);
  const [userClosedSettings, setUserClosedSettings] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState<string>('');
  const [isLeaving, setIsLeaving] = useState(false);

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

  // Auto-expand settings when match is 100% complete
  useEffect(() => {
    if (currentUserScore && Object.keys(currentUserScore.scores).length === 18) {
      setSettingsOpen(true);
      setUserClosedSettings(false);
    }
  }, [currentUserScore]);

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

  const handleFinalize = async () => {
    await confirmResults();
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
      const result = data as { status: string; remaining_players: number; match_status: string; refund_eligible: boolean };
      
      if (result.status === 'dnf') {
        if (result.refund_eligible) {
          toast({
            title: "Marked as DNF",
            description: `You have been marked as Did Not Finish. Your buy-in will be refunded. The match will continue with ${result.remaining_players} remaining player${result.remaining_players !== 1 ? 's' : ''}.`,
          });
        } else {
          toast({
            title: "Marked as DNF",
            description: `You have been marked as Did Not Finish and forfeit your buy-in. The match will continue with ${result.remaining_players} remaining player${result.remaining_players !== 1 ? 's' : ''}.`,
            variant: "destructive"
          });
        }
      } else {
        if (result.refund_eligible) {
          toast({
            title: "Match Cancelled",
            description: "All players have left. The match has been cancelled. Full refunds will be processed.",
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
      'best-ball': '2v2 Best Ball',
      'skins': 'Skins Game',
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
    <div className="w-full max-w-[1400px] mx-auto px-0 space-y-0 md:space-y-2 overflow-x-hidden">
      {/* Header with Course Name and Hamburger Menu */}
      <div className="px-4 md:px-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-primary rounded-lg">
              <Target className="w-5 h-5 text-primary-foreground" />
            </div>
            <h1 className="text-xl md:text-2xl font-bold">
              {matchData?.course_name || matchName || 'Golf Match'}
            </h1>
            {matchData?.status === 'cancelled' && (
              <Badge variant="destructive">Cancelled</Badge>
            )}
            {matchResult?.winner_id && user?.id && matchResult.winner_id === user.id && (
              <Badge variant="success">Winner</Badge>
            )}
          </div>
          
          {/* Back Button for Cancelled/Completed Matches or Hamburger Menu */}
          {matchData?.status === 'cancelled' || matchData?.status === 'completed' ? (
            <Button
              variant="success"
              onClick={onClose}
            >
              Back to Matches
            </Button>
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
                  <div className="text-sm font-semibold">{formatBuyIn(matchData?.buy_in_amount)}</div>
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
                            {Object.keys(player.scores).length}/18 holes
                          </div>
                        </div>
                      </div>
                      
                      {/* Progress Bar */}
                      <div className="mt-3">
                        <div className="w-full bg-muted rounded-full h-2">
                          <div 
                            className="bg-primary h-2 rounded-full transition-all duration-300" 
                            style={{ width: `${(Object.keys(player.scores).length / 18) * 100}%` }}
                          ></div>
                        </div>
                        <div className="text-xs text-muted-foreground mt-1 text-center">
                          {Math.round((Object.keys(player.scores).length / 18) * 100)}% Complete
                          {hasConfirmed && isMatchComplete && (
                            <span className="ml-2 text-green-600 font-medium">✓ Confirmed</span>
                          )}
                        </div>
                      </div>

                      {/* Leave Match Button - Mobile Only - Only shown for current user */}
                      {player.player_id === user?.id && !matchResult && !loading && matchData?.status !== 'cancelled' && (
                        <div className="mt-3 md:hidden">
                          <Button
                            onClick={() => setCancelDialogOpen(true)}
                            variant="ghost"
                            size="sm"
                            className="w-full"
                          >
                            <AlertTriangle className="w-3 h-3 mr-1 text-destructive" />
                            <span className="text-destructive">Leave Match</span>
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

      {/* Top Finalize Button - Shows when match is complete */}
      {isMatchComplete && canFinalize && !matchResult && (
        <div className="flex flex-col items-center gap-4 px-6 py-4">
          <div className="text-center">
            <h3 className="text-lg font-semibold mb-2">Round Complete!</h3>
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

      {/* Display Results when all confirmed */}
      {matchResult && (
        <MatchResultsDisplay 
          matchResult={matchResult}
          playerScores={playerScores}
          buyInAmount={matchData?.buy_in_amount}
        />
      )}

      {/* Scorecard */}
      {!matchResult && (
        <Card className="w-full border-0 md:border">
        <CardContent className="px-0 md:px-2 py-4">
          <Tabs defaultValue="front9" className="w-full">
            {/* Sticky Tabs Header */}
            <div className="sticky top-0 z-20 bg-background pb-2 px-2">
              <TabsList className="grid w-full grid-cols-2 h-10">
                <TabsTrigger value="front9" className="text-sm">Front 9</TabsTrigger>
                <TabsTrigger value="back9" className="text-sm">Back 9</TabsTrigger>
              </TabsList>
            </div>
            
            <TabsContent value="front9" className="mt-4">
              {/* Desktop Table View */}
              <div className="hidden md:block">
                <table className="w-full text-xs lg:text-sm">
                  <thead>
                    {/* Par Row */}
                    <tr className="border-b bg-muted/20">
                      <th className="text-left p-1 lg:p-2 text-xs lg:text-sm font-medium text-muted-foreground">PAR</th>
                      {Array.from({ length: 9 }, (_, i) => (
                        <th key={i + 1} className="text-center p-1 lg:p-2 text-xs lg:text-sm font-medium w-7 lg:w-10 text-muted-foreground">
                          {matchData?.hole_pars?.[String(i + 1)] || 4}
                        </th>
                      ))}
                      <th className="text-center p-1 lg:p-2 text-xs lg:text-sm font-medium bg-accent/20 text-muted-foreground">Total</th>
                    </tr>
                    {/* Hole Numbers Row */}
                    <tr className="border-b">
                      <th className="text-left p-1 lg:p-2 text-xs lg:text-sm font-medium">
                        <div className="flex items-center gap-1 lg:gap-2">
                          <span>Player</span>
                          <span className="text-muted-foreground">|</span>
                          <span className="text-muted-foreground">Hole</span>
                        </div>
                      </th>
                      {Array.from({ length: 9 }, (_, i) => (
                        <th key={i + 1} className="text-center p-1 lg:p-2 text-xs lg:text-sm font-medium w-7 lg:w-10">
                          {i + 1}
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
                        {Array.from({ length: 9 }, (_, i) => {
                          const hole = i + 1;
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
                        {Array.from({ length: 9 }, (_, i) => {
                          const hole = i + 1;
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
                          <h3 className="font-semibold text-accent-foreground">Total</h3>
                          <div className="text-sm text-muted-foreground">
                            {Object.keys(currentUserScore?.scores || {}).filter(h => parseInt(h) <= 9).length}/9 holes
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold text-accent-foreground">{currentUserScore?.front9 || 0}</div>
                          <div className="text-sm font-semibold text-accent-foreground">
                            {(() => {
                              // Only calculate for completed holes
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
                {Array.from({ length: 9 }, (_, i) => {
                  const hole = i + 1;
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
                              <div className="text-sm text-muted-foreground">Par {par}</div>
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
              <div className="hidden md:block">
                <table className="w-full text-xs lg:text-sm">
                  <thead>
                    {/* Par Row */}
                    <tr className="border-b bg-muted/20">
                      <th className="text-left p-1 lg:p-2 text-xs lg:text-sm font-medium text-muted-foreground">PAR</th>
                      {Array.from({ length: 9 }, (_, i) => (
                        <th key={i + 10} className="text-center p-1 lg:p-2 text-xs lg:text-sm font-medium w-7 lg:w-10 text-muted-foreground">
                          {matchData?.hole_pars?.[String(i + 10)] || 4}
                        </th>
                      ))}
                      <th className="text-center p-1 lg:p-2 text-xs lg:text-sm font-medium bg-accent/20 text-muted-foreground">Total</th>
                    </tr>
                    {/* Hole Numbers Row */}
                    <tr className="border-b">
                      <th className="text-left p-1 lg:p-2 text-xs lg:text-sm font-medium">
                        <div className="flex items-center gap-1 lg:gap-2">
                          <span>Player</span>
                          <span className="text-muted-foreground">|</span>
                          <span className="text-muted-foreground">Hole</span>
                        </div>
                      </th>
                      {Array.from({ length: 9 }, (_, i) => (
                        <th key={i + 10} className="text-center p-1 lg:p-2 text-xs lg:text-sm font-medium w-7 lg:w-10">
                          {i + 10}
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
                        {Array.from({ length: 9 }, (_, i) => {
                          const hole = i + 10;
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
                        {Array.from({ length: 9 }, (_, i) => {
                          const hole = i + 10;
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
                          <h3 className="font-semibold text-accent-foreground">Total</h3>
                          <div className="text-sm text-muted-foreground">
                            {Object.keys(currentUserScore?.scores || {}).filter(h => parseInt(h) >= 10).length}/9 holes
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold text-accent-foreground">{currentUserScore?.back9 || 0}</div>
                          <div className="text-sm font-semibold text-accent-foreground">
                            {(() => {
                              // Only calculate for completed holes
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
                {Array.from({ length: 9 }, (_, i) => {
                  const hole = i + 10;
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
                              <div className="text-sm text-muted-foreground">Par {par}</div>
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

      {!matchResult && !isMatchComplete && (
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
                const weatherOrCourseReasons = ['lightning', 'rain', 'temperature', 'course-closure', 'wildlife', 'equipment'];
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
                          <li>Your <strong>buy-in will be fully refunded</strong> ({formatBuyIn(matchData?.buy_in_amount)})</li>
                          {otherPlayersCount >= 2 ? (
                            <li>You will be marked as <strong>DNF</strong> and the match will continue</li>
                          ) : (
                            <li>The match will be <strong>cancelled</strong> with full refunds to all players</li>
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
            variant="ghost"
            size="sm"
            className="hover:bg-destructive/10"
          >
            <AlertTriangle className="w-3 h-3 mr-1 text-destructive" />
            <span className="text-destructive">Leave Match</span>
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

      {/* Editing Instructions - Remove this since we're using a dialog now */}
    </div>
  );
}
