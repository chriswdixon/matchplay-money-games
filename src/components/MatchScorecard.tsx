import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useMatchScoring, PlayerScore } from '@/hooks/useMatchScoring';
import { useAuth } from '@/hooks/useAuth';
import { Target, Trophy, Clock, CheckCircle, Users } from 'lucide-react';

interface MatchScorecardProps {
  matchId: string;
  matchName: string;
  onClose: () => void;
}

export function MatchScorecard({ matchId, matchName, onClose }: MatchScorecardProps) {
  const { user } = useAuth();
  const {
    playerScores,
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
          <Card key={player.player_id} className={player.player_id === user?.id ? 'ring-2 ring-primary' : ''}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-muted-foreground" />
                  <span className="font-medium">{player.player_name}</span>
                  {player.player_id === user?.id && (
                    <Badge variant="secondary" className="text-xs">You</Badge>
                  )}
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold">{player.total || 0}</div>
                  <div className="text-xs text-muted-foreground">
                    {Object.keys(player.scores).length}/18 holes
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Scorecard Grid */}
      <Card>
        <CardHeader>
          <CardTitle>18-Hole Scorecard</CardTitle>
          <CardDescription>
            Track your strokes for each hole. Click on your scores to edit them.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2 font-medium">Player</th>
                  {Array.from({ length: 18 }, (_, i) => (
                    <th key={i + 1} className="text-center p-2 font-medium w-12">
                      {i + 1}
                    </th>
                  ))}
                  <th className="text-center p-2 font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {/* Current User Row */}
                {currentUserScore && (
                  <tr className="border-b bg-muted/20">
                    <td className="p-2 font-medium">
                      <div className="flex items-center gap-2">
                        {currentUserScore.player_name}
                        <Badge variant="secondary" className="text-xs">You</Badge>
                      </div>
                    </td>
                    {Array.from({ length: 18 }, (_, i) => {
                      const hole = i + 1;
                      const score = currentUserScore.scores[hole];
                      const isEditing = editingHole === hole;

                      return (
                        <td key={hole} className="text-center p-1">
                          {isEditing ? (
                            <div className="flex items-center gap-1">
                              <Input
                                type="number"
                                min="1"
                                max="10"
                                value={tempScore}
                                onChange={(e) => setTempScore(e.target.value)}
                                className="w-12 h-8 text-center p-0"
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleScoreSave();
                                  if (e.key === 'Escape') handleScoreCancel();
                                }}
                                autoFocus
                              />
                            </div>
                          ) : (
                            <Button
                              variant={score ? "default" : "outline"}
                              size="sm"
                              className="w-8 h-8 p-0"
                              onClick={() => handleScoreEdit(hole, score)}
                              disabled={saving}
                            >
                              {score || '-'}
                            </Button>
                          )}
                        </td>
                      );
                    })}
                    <td className="text-center p-2 font-bold text-lg">
                      {currentUserScore.total || 0}
                    </td>
                  </tr>
                )}

                {/* Other Players Rows */}
                {otherPlayers.map((player) => (
                  <tr key={player.player_id} className="border-b">
                    <td className="p-2 font-medium">{player.player_name}</td>
                    {Array.from({ length: 18 }, (_, i) => {
                      const hole = i + 1;
                      const score = player.scores[hole];

                      return (
                        <td key={hole} className="text-center p-2">
                          <div className={`w-8 h-8 rounded-md flex items-center justify-center ${
                            score ? 'bg-muted text-foreground' : 'bg-background border border-border'
                          }`}>
                            {score || '-'}
                          </div>
                        </td>
                      );
                    })}
                    <td className="text-center p-2 font-bold">
                      {player.total || 0}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
        <Card className="border-accent">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-accent">
              <Target className="w-4 h-4" />
              <span className="font-medium">
                Editing Hole {editingHole} - Enter strokes (1-10) and press Enter to save, Escape to cancel
              </span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
