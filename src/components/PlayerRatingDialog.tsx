import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Star, Trophy } from 'lucide-react';
import { usePlayerRatings, RateablePlayer } from '@/hooks/usePlayerRatings';
import StarRating from './StarRating';
import { toast } from 'sonner';

interface PlayerRatingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  matchId: string;
  matchName: string;
}

const PlayerRatingDialog = ({ open, onOpenChange, matchId, matchName }: PlayerRatingDialogProps) => {
  const { loading, getRateablePlayersForMatch, ratePlayer, getPlayerRating } = usePlayerRatings();
  const [players, setPlayers] = useState<RateablePlayer[]>([]);
  const [playerRatings, setPlayerRatings] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState<string | null>(null);

  useEffect(() => {
    if (open && matchId) {
      loadPlayers();
    }
  }, [open, matchId]);

  const loadPlayers = async () => {
    const rateablePlayers = await getRateablePlayersForMatch(matchId);
    setPlayers(rateablePlayers);

    // Load existing ratings
    const ratings: Record<string, number> = {};
    for (const player of rateablePlayers) {
      const existingRating = await getPlayerRating(matchId, player.user_id);
      if (existingRating) {
        ratings[player.user_id] = existingRating;
      }
    }
    setPlayerRatings(ratings);
  };

  const handleRatePlayer = async (playerId: string, rating: number) => {
    setSubmitting(playerId);
    try {
      const success = await ratePlayer(matchId, playerId, rating);
      if (success) {
        setPlayerRatings(prev => ({ ...prev, [playerId]: rating }));
        // Update the player's already_rated status
        setPlayers(prev => prev.map(p => 
          p.user_id === playerId ? { ...p, already_rated: true } : p
        ));
      }
    } finally {
      setSubmitting(null);
    }
  };

  const getPlayerInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  if (loading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Rate Players</DialogTitle>
            <DialogDescription>Loading players...</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {Array.from({ length: 3 }, (_, i) => (
              <div key={i} className="animate-pulse">
                <div className="h-20 bg-muted rounded-lg"></div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-accent" />
            Rate Players
          </DialogTitle>
          <DialogDescription>
            Rate the players from your match at {matchName}
          </DialogDescription>
        </DialogHeader>
        
        {players.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">No other players to rate in this match.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {players.map((player) => {
              const currentRating = playerRatings[player.user_id] || 0;
              const isSubmittingThis = submitting === player.user_id;
              
              return (
                <Card key={player.user_id} className="bg-card">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <Avatar>
                        <AvatarFallback className="bg-gradient-primary text-primary-foreground">
                          {getPlayerInitials(player.display_name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <h4 className="font-medium text-foreground">{player.display_name}</h4>
                        {player.already_rated && (
                          <p className="text-xs text-muted-foreground">
                            {currentRating > 0 ? 'Already rated' : 'Previously rated'}
                          </p>
                        )}
                      </div>
                    </div>
                    
                    <div className="space-y-3">
                      <div>
                        <p className="text-sm font-medium mb-2">Rate this player (1-5 stars):</p>
                        <StarRating
                          rating={currentRating}
                          interactive={!isSubmittingThis}
                          size="lg"
                          onRatingChange={(rating) => handleRatePlayer(player.user_id, rating)}
                          className="justify-start"
                        />
                      </div>
                      
                      {isSubmittingThis && (
                        <p className="text-xs text-muted-foreground">Saving rating...</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            
            <div className="pt-4">
              <Button 
                variant="outline" 
                onClick={() => onOpenChange(false)}
                className="w-full"
              >
                Done
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default PlayerRatingDialog;