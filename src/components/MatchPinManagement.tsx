import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Lock, Copy, RefreshCw, Share2, Check } from 'lucide-react';
import { PinEntryDialog } from './PinEntryDialog';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface TeamPin {
  teamNumber: number;
  pin: string | null;
  pinCreator: string | null;
  canReset: boolean;
}

interface MatchPinManagementProps {
  matchId: string;
  isCreator: boolean;
  teamPins: TeamPin[];
  maxParticipants: number;
  onPinUpdated: () => void;
}

export const MatchPinManagement = ({
  matchId,
  isCreator,
  teamPins,
  maxParticipants,
  onPinUpdated,
}: MatchPinManagementProps) => {
  const [open, setOpen] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<number | null>(null);
  const [copiedPin, setCopiedPin] = useState<number | null>(null);

  const handleResetPin = (teamNumber: number) => {
    setSelectedTeam(teamNumber);
    setResetDialogOpen(true);
  };

  const handlePinSubmit = async (newPin: string) => {
    if (!selectedTeam) return;

    try {
      const columnName = `team${selectedTeam}_pin`;
      const { error } = await supabase
        .from('matches')
        .update({ [columnName]: newPin })
        .eq('id', matchId);

      if (error) throw error;

      toast.success(`Team ${selectedTeam} PIN updated successfully`);
      setResetDialogOpen(false);
      setSelectedTeam(null);
      onPinUpdated();
    } catch (error: any) {
      toast.error('Failed to update PIN: ' + error.message);
    }
  };

  const handleCopyPin = (teamNumber: number, pin: string) => {
    navigator.clipboard.writeText(pin);
    setCopiedPin(teamNumber);
    toast.success(`Team ${teamNumber} PIN copied to clipboard`);
    setTimeout(() => setCopiedPin(null), 2000);
  };

  const handleShareLink = (teamNumber: number, pin: string) => {
    const shareLink = `${window.location.origin}/?match=${matchId}&team=${teamNumber}&pin=${pin}`;
    navigator.clipboard.writeText(shareLink);
    toast.success('Shareable link copied to clipboard');
  };

  const getTeamName = (teamNumber: number) => {
    if (maxParticipants === 2) return teamNumber === 1 ? 'Creator' : 'Opponent';
    return `Team ${teamNumber}`;
  };

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            <Lock className="w-4 h-4 mr-2" />
            Manage PINs
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Match PIN Management</DialogTitle>
            <DialogDescription>
              View and manage access PINs for this match. Share PINs with teammates or reset them as needed.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {teamPins.map((teamPin) => (
              <Card key={teamPin.teamNumber}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center justify-between">
                    <span>{getTeamName(teamPin.teamNumber)}</span>
                    {teamPin.pin && (
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCopyPin(teamPin.teamNumber, teamPin.pin!)}
                        >
                          {copiedPin === teamPin.teamNumber ? (
                            <Check className="w-4 h-4 text-success" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleShareLink(teamPin.teamNumber, teamPin.pin!)}
                        >
                          <Share2 className="w-4 h-4" />
                        </Button>
                        {teamPin.canReset && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleResetPin(teamPin.teamNumber)}
                          >
                            <RefreshCw className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    )}
                  </CardTitle>
                  <CardDescription>
                    {teamPin.pin ? `PIN: ${teamPin.pin}` : 'No PIN set'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {teamPin.pin ? (
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">
                        Share this PIN with your team members to allow them to join
                      </p>
                      {teamPin.canReset && (
                        <p className="text-xs text-muted-foreground">
                          You can reset this PIN if it has been compromised
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No PIN required for this team
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <PinEntryDialog
        open={resetDialogOpen}
        onOpenChange={setResetDialogOpen}
        onSubmit={handlePinSubmit}
        title={`Reset Team ${selectedTeam} PIN`}
        description="Enter a new 4-digit PIN for this team"
        isSettingPin={true}
      />
    </>
  );
};
