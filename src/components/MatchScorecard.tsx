import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useMatchScoring, PlayerScore, MatchData } from '@/hooks/useMatchScoring';
import { useAuth } from '@/hooks/useAuth';
import { Target, Trophy, Clock, CheckCircle, Users, ChevronDown, DollarSign } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MatchScorecardProps {
  matchId: string;
  matchName: string;
  onClose: () => void;
}

export function MatchScorecard({ matchId, matchName, onClose }: MatchScorecardProps) {
  const { user } = useAuth();
  const {
    playerScores,
    matchData,
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
  const [settingsOpen, setSettingsOpen] = useState(true);
  const activeHoleRef = useRef<HTMLDivElement>(null);

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
    await finalizeResults();
  };

  const handleConfirm = async () => {
    await confirmResults();
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
    <div className="w-full max-w-[1400px] mx-auto px-0 space-y-2">
      {/* Scorecard - Full width on mobile, comes first */}
      <Card className="w-full border-0 md:border">
        <CardHeader className="px-2 md:px-6">
          <CardTitle>Match Scorecard</CardTitle>
        </CardHeader>
        <CardContent className="px-0 md:px-2 py-4">
          <Tabs defaultValue="front9" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="front9">Front 9</TabsTrigger>
              <TabsTrigger value="back9">Back 9</TabsTrigger>
            </TabsList>
            
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
                                disabled={saving}
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
                {/* Front 9 Total Card - Sticky */}
                <div className="sticky top-0 z-10 bg-background pb-4">
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
                <div className="space-y-4">
                {Array.from({ length: 9 }, (_, i) => {
                  const hole = i + 1;
                  const par = matchData?.hole_pars?.[String(hole)] || 4;
                  const currentScore = currentUserScore?.scores[hole];
                  
                  // Find the active hole (first hole after last scored hole)
                  const completedHoles = Array.from({ length: 9 }, (_, j) => j + 1)
                    .filter(h => currentUserScore?.scores[h]);
                  const lastCompletedHole = completedHoles.length > 0 ? Math.max(...completedHoles) : 0;
                  const isActiveHole = hole === lastCompletedHole + 1 && !currentScore;
                  
                  return (
                    <Card 
                      key={hole} 
                      ref={isActiveHole ? activeHoleRef : null}
                      className={cn("w-full", isActiveHole && "border-2 border-primary bg-primary/5")}
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
                              "w-16 h-16 text-xl font-bold transition-all",
                              currentScore 
                                ? "bg-primary text-primary-foreground hover:bg-primary/90" 
                                : isActiveHole
                                ? "border-2 border-primary bg-primary/20 hover:bg-primary/30 animate-pulse"
                                : "border-dashed hover:border-primary hover:bg-primary/10"
                            )}
                            onClick={() => handleScoreEdit(hole, currentScore)}
                            disabled={saving}
                          >
                            {currentScore || '+'}
                          </Button>
                        </div>
                        
                        {/* Other players' scores for this hole */}
                        {otherPlayers.length > 0 && (
                          <div className="pt-3 border-t space-y-2">
                            <div className="text-sm font-medium text-muted-foreground">Other Players:</div>
                            <div className="flex flex-wrap gap-2">
                              {otherPlayers.map((player) => (
                                <div key={player.player_id} className="flex items-center gap-2 bg-muted/20 rounded-lg px-3 py-1">
                                  <span className="text-sm font-medium">{player.player_name}</span>
                                  <div className="w-8 h-8 rounded bg-muted text-muted-foreground flex items-center justify-center text-sm font-medium">
                                    {player.scores[hole] || '—'}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
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
                                disabled={saving}
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
                {/* Back 9 Total Card - Sticky */}
                <div className="sticky top-0 z-10 bg-background pb-4">
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
                <div className="space-y-4">
                {Array.from({ length: 9 }, (_, i) => {
                  const hole = i + 10;
                  const par = matchData?.hole_pars?.[String(hole)] || 4;
                  const currentScore = currentUserScore?.scores[hole];
                  
                  // Find the active hole (first hole after last scored hole)
                  const completedHoles = Array.from({ length: 9 }, (_, j) => j + 10)
                    .filter(h => currentUserScore?.scores[h]);
                  const lastCompletedHole = completedHoles.length > 0 ? Math.max(...completedHoles) : 9;
                  const isActiveHole = hole === lastCompletedHole + 1 && !currentScore;
                  
                  return (
                    <Card 
                      key={hole} 
                      ref={isActiveHole ? activeHoleRef : null}
                      className={cn("w-full", isActiveHole && "border-2 border-primary bg-primary/5")}
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
                              "w-16 h-16 text-xl font-bold transition-all",
                              currentScore 
                                ? "bg-primary text-primary-foreground hover:bg-primary/90" 
                                : isActiveHole
                                ? "border-2 border-primary bg-primary/20 hover:bg-primary/30 animate-pulse"
                                : "border-dashed hover:border-primary hover:bg-primary/10"
                            )}
                            onClick={() => handleScoreEdit(hole, currentScore)}
                            disabled={saving}
                          >
                            {currentScore || '+'}
                          </Button>
                        </div>
                        
                        {/* Other players' scores for this hole */}
                        {otherPlayers.length > 0 && (
                          <div className="pt-3 border-t space-y-2">
                            <div className="text-sm font-medium text-muted-foreground">Other Players:</div>
                            <div className="flex flex-wrap gap-2">
                              {otherPlayers.map((player) => (
                                <div key={player.player_id} className="flex items-center gap-2 bg-muted/20 rounded-lg px-3 py-1">
                                  <span className="text-sm font-medium">{player.player_name}</span>
                                  <div className="w-8 h-8 rounded bg-muted text-muted-foreground flex items-center justify-center text-sm font-medium">
                                    {player.scores[hole] || '—'}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
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

      {/* Header - Moved below scorecard */}
      <div className="px-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-primary rounded-lg">
            <Target className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">{matchName}</h1>
          </div>
        </div>

        {/* Match Settings Button - Directly below course name */}
        <div>
          <Collapsible open={settingsOpen} onOpenChange={setSettingsOpen}>
            <CollapsibleTrigger asChild>
              <Button 
                variant="outline" 
                className="w-full flex items-center justify-between"
              >
                <span className="flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Match Settings
                </span>
                <ChevronDown className={cn("w-4 h-4 transition-transform", settingsOpen && "rotate-180")} />
              </Button>
            </CollapsibleTrigger>
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
                {playerScores.map((player) => (
                  <Card key={player.player_id} className={player.player_id === user?.id ? 'ring-2 ring-primary bg-primary/5' : 'bg-card'}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4 text-muted-foreground" />
                          <span className="font-medium">{player.player_name}</span>
                          {player.player_id === user?.id && (
                            <Badge variant="default" className="text-xs bg-primary">You</Badge>
                          )}
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold text-primary">{player.total || 0}</div>
                          <div className="text-xs text-muted-foreground">
                            Front 9: {player.front9} | Back 9: {player.back9}
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
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>

        {/* Back to Matches Button - Below Match Settings */}
        <div className="mt-4">
          <Button 
            variant="default" 
            onClick={onClose} 
            className="w-full bg-[hsl(var(--accent))] text-accent-foreground hover:bg-[hsl(var(--accent))]/90"
          >
            Back to Matches
          </Button>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-center gap-4 px-6">
        {isMatchComplete && canFinalize && (
          <Button
            onClick={handleFinalize}
            disabled={saving}
            className="bg-gradient-primary text-primary-foreground hover:shadow-premium"
          >
            <Trophy className="w-4 h-4 mr-2" />
            {saving ? "Finalizing..." : "Finalize Results"}
          </Button>
        )}

        {!isMatchComplete && (
          <div className="text-center text-muted-foreground">
            <Clock className="w-5 h-5 mx-auto mb-2" />
            <p>Complete all 18 holes to finalize results</p>
          </div>
        )}
      </div>

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
            {/* Manual Input */}
            <div className="space-y-2">
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
              <label className="text-sm font-medium">Quick Entry</label>
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

      {/* Editing Instructions - Remove this since we're using a dialog now */}
    </div>
  );
}
