import { useMemo, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Wallet, Clock, ScrollText, Trophy } from "lucide-react";
import { format } from "date-fns";

export interface JoinMatchConfirmInfo {
  course_name: string;
  scheduled_time: string;
  format: string;
  holes: number;
  buy_in_amount: number;
  max_participants: number;
  participant_count?: number;
  is_team_format?: boolean;
}

interface JoinMatchConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  match: JoinMatchConfirmInfo | null;
  onConfirm: () => void | Promise<void>;
}

const formatLabel = (f: string) => {
  const map: Record<string, string> = {
    "stroke-play": "Stroke Play",
    "match-play": "Match Play",
    "best-ball": "Best Ball",
    scramble: "Scramble",
  };
  return map[f] || f;
};

const JoinMatchConfirmDialog = ({
  open,
  onOpenChange,
  match,
  onConfirm,
}: JoinMatchConfirmDialogProps) => {
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const totalPot = useMemo(() => {
    if (!match) return 0;
    return (match.buy_in_amount || 0) * match.max_participants;
  }, [match]);

  const estimatedPayout = useMemo(() => {
    if (!match) return null;
    const start = new Date(match.scheduled_time);
    // Average round time + review buffer
    const hoursToPlay = match.holes >= 18 ? 4.5 : 2.5;
    const finished = new Date(start.getTime() + hoursToPlay * 60 * 60 * 1000);
    const payoutBy = new Date(finished.getTime() + 30 * 60 * 1000); // +30 min review
    return payoutBy;
  }, [match]);

  const handleConfirm = async () => {
    if (!agreed || submitting) return;
    setSubmitting(true);
    try {
      await onConfirm();
      onOpenChange(false);
      setAgreed(false);
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenChange = (next: boolean) => {
    if (submitting) return;
    if (!next) setAgreed(false);
    onOpenChange(next);
  };

  if (!match) return null;

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-primary" aria-hidden="true" />
            Confirm Join Match
          </AlertDialogTitle>
          <AlertDialogDescription className="text-left">
            Review the details below before joining{" "}
            <span className="font-semibold text-foreground">
              {match.course_name}
            </span>
            .
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4">
          {/* Money */}
          <div className="rounded-xl border bg-muted/40 p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Wallet className="w-4 h-4 text-primary" aria-hidden="true" />
              Buy-in &amp; Pot
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-muted-foreground">Your buy-in</span>
              <span className="text-2xl font-bold text-foreground">
                ${match.buy_in_amount}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Total pot ({match.max_participants} players)</span>
              <span className="font-semibold text-foreground">
                ${totalPot}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground pt-1">
              Funds are held from your Play Money balance until the match is
              finalized.
            </p>
          </div>

          {/* Match summary */}
          <div className="rounded-xl border p-4 space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Format</span>
              <Badge variant="secondary">{formatLabel(match.format)}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Holes</span>
              <span className="font-medium">{match.holes}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Tee time</span>
              <span className="font-medium">
                {format(new Date(match.scheduled_time), "MMM d, h:mm a")}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Players</span>
              <span className="font-medium">
                {match.participant_count || 0}/{match.max_participants}
              </span>
            </div>
          </div>

          {/* Payout timing */}
          <div className="rounded-xl border bg-primary/5 p-4 space-y-1">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Clock className="w-4 h-4 text-primary" aria-hidden="true" />
              Estimated payout
            </div>
            <p className="text-sm">
              {estimatedPayout
                ? `By ${format(estimatedPayout, "MMM d, h:mm a")}`
                : "After all players finalize scores"}
            </p>
            <p className="text-[11px] text-muted-foreground">
              Winnings post to your account once every player confirms the
              final scorecard (typically within 30 minutes of the last hole).
            </p>
          </div>

          {/* Terms */}
          <div className="rounded-xl border p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <ScrollText className="w-4 h-4 text-primary" aria-hidden="true" />
              Match rules
            </div>
            <ul className="text-xs text-muted-foreground space-y-1 list-disc pl-4">
              <li>Skill-based competitive play — not gambling.</li>
              <li>You must complete every hole to be eligible for payout.</li>
              <li>
                Leaving or forfeiting after start may forfeit your buy-in.
              </li>
              <li>Disputes are reviewed by LinkUp admins.</li>
            </ul>
          </div>

          <Separator />

          <div className="flex items-start gap-2">
            <Checkbox
              id="confirm-join-terms"
              checked={agreed}
              onCheckedChange={(v) => setAgreed(v === true)}
              disabled={submitting}
            />
            <Label
              htmlFor="confirm-join-terms"
              className="text-xs leading-relaxed cursor-pointer"
            >
              I agree to the match rules and authorize ${match.buy_in_amount}{" "}
              to be held from my Play Money balance.
            </Label>
          </div>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={submitting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={!agreed || submitting}
            className="bg-primary text-primary-foreground hover:opacity-90"
          >
            {submitting ? "Joining..." : `Confirm & Join`}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default JoinMatchConfirmDialog;
