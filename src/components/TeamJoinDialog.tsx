import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Users, Lock } from 'lucide-react';

interface TeamJoinDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (teamNumber: number, pin?: string, setPin?: string) => void;
  maxParticipants: number;
  occupiedTeams: number[];
}

export const TeamJoinDialog = ({
  open,
  onOpenChange,
  onSubmit,
  maxParticipants,
  occupiedTeams,
}: TeamJoinDialogProps) => {
  const [selectedTeam, setSelectedTeam] = useState<string>('');
  const [pin, setPin] = useState('');
  const [newTeamPin, setNewTeamPin] = useState('');
  const [confirmNewPin, setConfirmNewPin] = useState('');
  const [error, setError] = useState('');

  const numTeams = maxParticipants / 2;
  const availableTeams = Array.from({ length: numTeams }, (_, i) => i + 1).filter(
    (team) => team !== 1 // Team 1 is always the creator
  );

  const teamHasPin = (teamNumber: number) => occupiedTeams.includes(teamNumber);
  const isFirstOnTeam = (teamNumber: number) => !occupiedTeams.includes(teamNumber);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!selectedTeam) {
      setError('Please select a team');
      return;
    }

    const teamNumber = parseInt(selectedTeam);

    // If first on team, require setting a PIN
    if (isFirstOnTeam(teamNumber)) {
      if (newTeamPin.length !== 4 || !/^\d{4}$/.test(newTeamPin)) {
        setError('PIN must be exactly 4 digits');
        return;
      }
      if (newTeamPin !== confirmNewPin) {
        setError('PINs do not match');
        return;
      }
      onSubmit(teamNumber, undefined, newTeamPin);
    } else {
      // Joining existing team with PIN
      if (pin.length !== 4 || !/^\d{4}$/.test(pin)) {
        setError('PIN must be exactly 4 digits');
        return;
      }
      onSubmit(teamNumber, pin);
    }

    handleClose();
  };

  const handleClose = () => {
    setSelectedTeam('');
    setPin('');
    setNewTeamPin('');
    setConfirmNewPin('');
    setError('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            <DialogTitle>Join Team</DialogTitle>
          </div>
          <DialogDescription>
            Select which team you want to join for this match
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Select Team</Label>
              <RadioGroup value={selectedTeam} onValueChange={setSelectedTeam}>
                {availableTeams.map((teamNum) => (
                  <div key={teamNum} className="flex items-center space-x-2">
                    <RadioGroupItem value={teamNum.toString()} id={`team-${teamNum}`} />
                    <Label htmlFor={`team-${teamNum}`} className="flex items-center gap-2 cursor-pointer">
                      Team {teamNum}
                      {teamHasPin(teamNum) && (
                        <Lock className="w-3 h-3 text-amber-500" />
                      )}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>

            {selectedTeam && (
              <>
                {isFirstOnTeam(parseInt(selectedTeam)) ? (
                  <div className="space-y-4 p-4 border rounded-lg bg-muted/50">
                    <p className="text-sm font-medium">You'll be the first on Team {selectedTeam}!</p>
                    <p className="text-sm text-muted-foreground">Set a PIN for your team members to join</p>
                    <div className="space-y-2">
                      <Label htmlFor="newPin">Team PIN (4 digits)</Label>
                      <Input
                        id="newPin"
                        type="text"
                        inputMode="numeric"
                        pattern="\d{4}"
                        maxLength={4}
                        value={newTeamPin}
                        onChange={(e) => setNewTeamPin(e.target.value.replace(/\D/g, ''))}
                        placeholder="0000"
                        className="text-center text-2xl tracking-widest font-mono"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="confirmNewPin">Confirm PIN</Label>
                      <Input
                        id="confirmNewPin"
                        type="text"
                        inputMode="numeric"
                        pattern="\d{4}"
                        maxLength={4}
                        value={confirmNewPin}
                        onChange={(e) => setConfirmNewPin(e.target.value.replace(/\D/g, ''))}
                        placeholder="0000"
                        className="text-center text-2xl tracking-widest font-mono"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label htmlFor="teamPin">Enter Team {selectedTeam} PIN</Label>
                    <Input
                      id="teamPin"
                      type="text"
                      inputMode="numeric"
                      pattern="\d{4}"
                      maxLength={4}
                      value={pin}
                      onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                      placeholder="0000"
                      className="text-center text-2xl tracking-widest font-mono"
                      autoFocus
                    />
                    <p className="text-xs text-muted-foreground">
                      Ask your team captain for the PIN
                    </p>
                  </div>
                )}
              </>
            )}

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit">
              Join Team
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
