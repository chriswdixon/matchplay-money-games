import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useMatchScoring, PlayerScore, MatchData } from '@/hooks/useMatchScoring';
import { useAuth } from '@/hooks/useAuth';
import { Target, Trophy, Clock, CheckCircle, Users } from 'lucide-react';
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

  const currentUserScore = playerScores.find(p => p.player_id === user?.id);
  const otherPlayers = playerScores.filter(p => p.player_id !== user?.id);

  const handleScoreEdit = (hole: number, currentScore?: number) => {
    setEditingHole(hole);
    setTempScore(currentScore?.toString() || '');
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
    }
  };

  const handleScoreCancel = () => {
    setEditingHole(null);
    setTempScore('');
  };

  const handleFinalize = async () => {
    await finalizeResults();
  };

  const handleConfirm = async () => {
    await confirmResults();
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
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-primary rounded-lg">
            <Target className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Match Scorecard</h1>
            <p className="text-muted-foreground">{matchName}</p>
          </div>
        </div>
        <Button variant="outline" onClick={onClose}>
          Back to Matches
        </Button>
      </div>

      {/* Player Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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

      {/* Scorecard Tabs */}
      <Card>
        <CardHeader>
          <CardTitle>18-Hole Scorecard</CardTitle>
          <CardDescription>
            Track your strokes for each hole. Click on your scores to edit them.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="front9" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="front9">Front 9</TabsTrigger>
              <TabsTrigger value="back9">Back 9</TabsTrigger>
            </TabsList>
            
            <TabsContent value="front9" className="mt-4">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    {/* Par Row */}
                    <tr className="border-b bg-muted/20">
                      <th className="text-left p-2 font-medium text-muted-foreground">PAR</th>
                      {Array.from({ length: 9 }, (_, i) => (
                        <th key={i + 1} className="text-center p-2 font-medium w-12 text-muted-foreground">
                          {matchData?.hole_pars?.[String(i + 1)] || 4}
                        </th>
                      ))}
                      <th className="text-center p-2 font-medium bg-accent/20 text-muted-foreground">Total</th>
                    </tr>
                    {/* Hole Numbers Row */}
                    <tr className="border-b">
                      <th className="text-left p-2 font-medium">Player</th>
                      {Array.from({ length: 9 }, (_, i) => (
                        <th key={i + 1} className="text-center p-2 font-medium w-12">
                          {i + 1}
                        </th>
                      ))}
                      <th className="text-center p-2 font-medium bg-accent/20">Front 9</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Current User Row */}
                    {currentUserScore && (
                      <tr className="border-b bg-primary/5">
                        <td className="p-2 font-medium">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-primary"></div>
                            {currentUserScore.player_name}
                            <Badge variant="default" className="text-xs bg-primary">You</Badge>
                          </div>
                        </td>
                        {/* Front 9 holes */}
                        {Array.from({ length: 9 }, (_, i) => {
                          const hole = i + 1;
                          const score = currentUserScore.scores[hole];
                          const isEditing = editingHole === hole;

                          return (
                            <td key={hole} className="text-center p-1">
                              {isEditing ? (
                                <div className="flex flex-col items-center gap-1">
                                  <Input
                                    type="number"
                                    min="1"
                                    max="10"
                                    value={tempScore}
                                    onChange={(e) => setTempScore(e.target.value)}
                                    className="w-12 h-8 text-center p-0 border-primary"
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') handleScoreSave();
                                      if (e.key === 'Escape') handleScoreCancel();
                                    }}
                                    placeholder="1-10"
                                    autoFocus
                                  />
                                  <div className="flex gap-1">
                                    <Button
                                      size="sm"
                                      variant="default"
                                      className="w-4 h-4 p-0 text-xs"
                                      onClick={handleScoreSave}
                                    >
                                      ✓
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="w-4 h-4 p-0 text-xs"
                                      onClick={handleScoreCancel}
                                    >
                                      ✕
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                <Button
                                  variant={score ? "default" : "outline"}
                                  size="sm"
                                  className={cn(
                                    "w-10 h-10 p-0 text-sm font-semibold transition-all",
                                    score 
                                      ? "bg-primary text-primary-foreground hover:bg-primary/90" 
                                      : "border-dashed hover:border-primary hover:bg-primary/10"
                                  )}
                                  onClick={() => handleScoreEdit(hole, score)}
                                  disabled={saving}
                                >
                                  {score || '+'}
                                </Button>
                              )}
                            </td>
                          );
                        })}
                        
                        {/* Front 9 Total */}
                        <td className="text-center p-2">
                          <div className="bg-accent text-accent-foreground rounded-lg px-3 py-2 font-bold text-lg">
                            {currentUserScore.front9 || 0}
                          </div>
                        </td>
                      </tr>
                    )}

                    {/* Other Players Rows */}
                    {otherPlayers.map((player) => (
                      <tr key={player.player_id} className="border-b hover:bg-muted/10">
                        <td className="p-2 font-medium">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-muted-foreground"></div>
                            {player.player_name}
                          </div>
                        </td>
                        {/* Front 9 holes */}
                        {Array.from({ length: 9 }, (_, i) => {
                          const hole = i + 1;
                          const score = player.scores[hole];

                          return (
                            <td key={hole} className="text-center p-2">
                              <div className={cn(
                                "w-10 h-10 rounded-lg flex items-center justify-center font-medium transition-all",
                                score 
                                  ? 'bg-muted text-foreground border-2 border-border' 
                                  : 'bg-muted/30 border-2 border-dashed border-border/50 text-muted-foreground'
                              )}>
                                {score || '—'}
                              </div>
                            </td>
                          );
                        })}
                        {/* Front 9 Total */}
                        <td className="text-center p-2">
                          <div className="bg-accent text-accent-foreground rounded-lg px-3 py-2 font-bold text-lg">
                            {player.front9 || 0}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </TabsContent>

            <TabsContent value="back9" className="mt-4">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    {/* Par Row */}
                    <tr className="border-b bg-muted/20">
                      <th className="text-left p-2 font-medium text-muted-foreground">PAR</th>
                      {Array.from({ length: 9 }, (_, i) => (
                        <th key={i + 10} className="text-center p-2 font-medium w-12 text-muted-foreground">
                          {matchData?.hole_pars?.[String(i + 10)] || 4}
                        </th>
                      ))}
                      <th className="text-center p-2 font-medium bg-accent/20 text-muted-foreground">Total</th>
                    </tr>
                    {/* Hole Numbers Row */}
                    <tr className="border-b">
                      <th className="text-left p-2 font-medium">Player</th>
                      {Array.from({ length: 9 }, (_, i) => (
                        <th key={i + 10} className="text-center p-2 font-medium w-12">
                          {i + 10}
                        </th>
                      ))}
                      <th className="text-center p-2 font-medium bg-accent/20">Back 9</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Current User Row */}
                    {currentUserScore && (
                      <tr className="border-b bg-primary/5">
                        <td className="p-2 font-medium">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-primary"></div>
                            {currentUserScore.player_name}
                            <Badge variant="default" className="text-xs bg-primary">You</Badge>
                          </div>
                        </td>
                        {/* Back 9 holes */}
                        {Array.from({ length: 9 }, (_, i) => {
                          const hole = i + 10;
                          const score = currentUserScore.scores[hole];
                          const isEditing = editingHole === hole;

                          return (
                            <td key={hole} className="text-center p-1">
                              {isEditing ? (
                                <div className="flex flex-col items-center gap-1">
                                  <Input
                                    type="number"
                                    min="1"
                                    max="10"
                                    value={tempScore}
                                    onChange={(e) => setTempScore(e.target.value)}
                                    className="w-12 h-8 text-center p-0 border-primary"
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') handleScoreSave();
                                      if (e.key === 'Escape') handleScoreCancel();
                                    }}
                                    placeholder="1-10"
                                    autoFocus
                                  />
                                  <div className="flex gap-1">
                                    <Button
                                      size="sm"
                                      variant="default"
                                      className="w-4 h-4 p-0 text-xs"
                                      onClick={handleScoreSave}
                                    >
                                      ✓
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="w-4 h-4 p-0 text-xs"
                                      onClick={handleScoreCancel}
                                    >
                                      ✕
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                <Button
                                  variant={score ? "default" : "outline"}
                                  size="sm"
                                  className={cn(
                                    "w-10 h-10 p-0 text-sm font-semibold transition-all",
                                    score 
                                      ? "bg-primary text-primary-foreground hover:bg-primary/90" 
                                      : "border-dashed hover:border-primary hover:bg-primary/10"
                                  )}
                                  onClick={() => handleScoreEdit(hole, score)}
                                  disabled={saving}
                                >
                                  {score || '+'}
                                </Button>
                              )}
                            </td>
                          );
                        })}
                        
                        {/* Back 9 Total */}
                        <td className="text-center p-2">
                          <div className="bg-accent text-accent-foreground rounded-lg px-3 py-2 font-bold text-lg">
                            {currentUserScore.back9 || 0}
                          </div>
                        </td>
                      </tr>
                    )}

                    {/* Other Players Rows */}
                    {otherPlayers.map((player) => (
                      <tr key={player.player_id} className="border-b hover:bg-muted/10">
                        <td className="p-2 font-medium">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-muted-foreground"></div>
                            {player.player_name}
                          </div>
                        </td>
                        {/* Back 9 holes */}
                        {Array.from({ length: 9 }, (_, i) => {
                          const hole = i + 10;
                          const score = player.scores[hole];

                          return (
                            <td key={hole} className="text-center p-2">
                              <div className={cn(
                                "w-10 h-10 rounded-lg flex items-center justify-center font-medium transition-all",
                                score 
                                  ? 'bg-muted text-foreground border-2 border-border' 
                                  : 'bg-muted/30 border-2 border-dashed border-border/50 text-muted-foreground'
                              )}>
                                {score || '—'}
                              </div>
                            </td>
                          );
                        })}
                        {/* Back 9 Total */}
                        <td className="text-center p-2">
                          <div className="bg-accent text-accent-foreground rounded-lg px-3 py-2 font-bold text-lg">
                            {player.back9 || 0}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex justify-center gap-4">
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

      {/* Editing Instructions */}
      {editingHole && (
        <Card className="border-accent bg-accent/5">
          <CardContent className="p-4">
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-2 text-accent">
                <Target className="w-4 h-4" />
                <span className="font-medium">
                  Editing Hole {editingHole} - Enter your stroke count
                </span>
              </div>
              
              {/* Quick Score Buttons */}
              <div className="flex flex-wrap gap-2 justify-center">
                <div className="text-sm text-muted-foreground mb-2 w-full text-center">Quick Entry:</div>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((score) => (
                  <Button
                    key={score}
                    variant="outline"
                    size="sm"
                    className="w-10 h-10 p-0 hover:bg-primary hover:text-primary-foreground"
                    onClick={() => {
                      setTempScore(score.toString());
                      setTimeout(() => handleScoreSave(), 100);
                    }}
                  >
                    {score}
                  </Button>
                ))}
              </div>
              
              <div className="text-xs text-center text-muted-foreground">
                Or type in the input field above and press Enter to save, Escape to cancel
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
