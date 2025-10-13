import { useState } from 'react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { AlertTriangle, CheckCircle } from 'lucide-react';
import { CancellationConfirmation } from '@/hooks/useCancellationConfirmations';

interface CancellationConfirmationDialogProps {
  confirmation: CancellationConfirmation;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (confirmed: boolean, alternateReason?: string) => Promise<void>;
}

const REASON_LABELS: Record<string, string> = {
  'injury': 'Injury or sudden pain',
  'medical': 'Medical emergency or illness',
  'mental': 'Mental or emotional distress',
  'lightning': 'Lightning or dangerous storms',
  'rain': 'Heavy rain or flooding',
  'temperature': 'Extreme heat or cold',
  'course-closure': 'Course closure or suspension of play',
  'equipment': 'Equipment failure',
  'wildlife': 'Dangerous wildlife or terrain',
  'withdrawal': 'Opponent or partner withdrawal',
  'unsafe-play': 'Unsafe or disruptive play by others',
  'emergency-call': 'Emergency family call',
  'personal': 'Personal emergency',
  'other': 'Other reason'
};

export function CancellationConfirmationDialog({
  confirmation,
  open,
  onOpenChange,
  onConfirm
}: CancellationConfirmationDialogProps) {
  const [agreement, setAgreement] = useState<'agree' | 'disagree' | null>(null);
  const [alternateReason, setAlternateReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!agreement) return;

    setSubmitting(true);
    await onConfirm(
      agreement === 'agree',
      agreement === 'disagree' ? alternateReason : undefined
    );
    setSubmitting(false);
    onOpenChange(false);
    
    // Reset form
    setAgreement(null);
    setAlternateReason('');
  };

  const reasonLabel = REASON_LABELS[confirmation.stated_reason] || confirmation.stated_reason;
  const weatherOrCourseReasons = ['lightning', 'rain', 'temperature', 'course-closure', 'wildlife'];
  const isRefundEligible = weatherOrCourseReasons.includes(confirmation.stated_reason);

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            Confirm Player Cancellation
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-4 pt-2">
            <div className="bg-muted p-4 rounded-lg space-y-2">
              <p className="font-semibold text-foreground">
                {confirmation.cancelling_player_name} has left the match
              </p>
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">Stated reason:</p>
                <p className="text-sm">{reasonLabel}</p>
              </div>
              {isRefundEligible && (
                <div className="flex items-start gap-2 text-sm text-blue-600 dark:text-blue-400 bg-blue-500/10 p-2 rounded">
                  <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>This reason qualifies for buy-in refund (minus $2 cancellation fee)</span>
                </div>
              )}
            </div>

            <div className="space-y-3">
              <p className="text-sm font-medium text-foreground">
                Do you agree with this cancellation reason?
              </p>
              
              <RadioGroup value={agreement || ''} onValueChange={(value) => setAgreement(value as 'agree' | 'disagree')}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="agree" id="agree" />
                  <Label htmlFor="agree" className="cursor-pointer font-normal">
                    Yes, I agree with this reason
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="disagree" id="disagree" />
                  <Label htmlFor="disagree" className="cursor-pointer font-normal">
                    No, I believe the actual reason was different
                  </Label>
                </div>
              </RadioGroup>

              {agreement === 'disagree' && (
                <div className="space-y-2 pl-6">
                  <Label htmlFor="alternate-reason" className="text-sm font-medium">
                    What do you believe was the actual reason?
                  </Label>
                  <Textarea
                    id="alternate-reason"
                    value={alternateReason}
                    onChange={(e) => setAlternateReason(e.target.value)}
                    placeholder="Please explain the actual reason..."
                    className="min-h-[100px]"
                  />
                </div>
              )}
            </div>

            <p className="text-xs text-muted-foreground">
              Your confirmation helps ensure fair play and accurate refund processing. 
              If multiple players disagree with the stated reason, it may be reviewed by administrators.
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={submitting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleSubmit}
            disabled={!agreement || (agreement === 'disagree' && !alternateReason.trim()) || submitting}
          >
            {submitting ? 'Submitting...' : 'Submit Confirmation'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
