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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Wallet,
  Clock,
  ScrollText,
  Trophy,
  AlertTriangle,
  ShieldAlert,
  ChevronDown,
  Lock,
  CircleDollarSign,
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { usePlayerAccount } from "@/hooks/usePlayerAccount";

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

type Status = "pre-join" | "joining" | "joined";

const JoinMatchConfirmDialog = ({
  open,
  onOpenChange,
  match,
  onConfirm,
}: JoinMatchConfirmDialogProps) => {
  const [agreed, setAgreed] = useState(false);
  const [status, setStatus] = useState<Status>("pre-join");
  const [showFullRules, setShowFullRules] = useState(false);

  const { account, loading: balanceLoading } = usePlayerAccount();
  const balance = account?.balance ?? 0;

  const totalPot = useMemo(() => {
    if (!match) return 0;
    return (match.buy_in_amount || 0) * match.max_participants;
  }, [match]);

  const estimatedPayout = useMemo(() => {
    if (!match) return null;
    const start = new Date(match.scheduled_time);
    const hoursToPlay = match.holes >= 18 ? 4.5 : 2.5;
    const finished = new Date(start.getTime() + hoursToPlay * 60 * 60 * 1000);
    const payoutBy = new Date(finished.getTime() + 30 * 60 * 1000);
    return payoutBy;
  }, [match]);

  const buyIn = match?.buy_in_amount ?? 0;
  const insufficient = !balanceLoading && balance < buyIn;
  const balanceAfter = Math.max(balance - buyIn, 0);

  const handleConfirm = async () => {
    if (!agreed || status === "joining" || insufficient) return;
    setStatus("joining");
    try {
      await onConfirm();
      setStatus("joined");
      // Auto-close shortly after the post-join status displays
      setTimeout(() => {
        onOpenChange(false);
        setStatus("pre-join");
        setAgreed(false);
        setShowFullRules(false);
      }, 1600);
    } catch {
      setStatus("pre-join");
    }
  };

  const handleOpenChange = (next: boolean) => {
    if (status === "joining") return;
    if (!next) {
      setAgreed(false);
      setStatus("pre-join");
      setShowFullRules(false);
    }
    onOpenChange(next);
  };

  if (!match) return null;

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent className="max-w-md p-0 overflow-hidden">
        <ScrollArea className="max-h-[85vh]">
          <div className="p-6 space-y-4">
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

            {/* Status line */}
            <div
              role="status"
              aria-live="polite"
              className={cn(
                "rounded-xl border-l-4 px-3 py-2 text-xs font-medium flex items-center gap-2",
                status === "pre-join" &&
                  "border-l-muted-foreground bg-muted/50 text-muted-foreground",
                status === "joining" &&
                  "border-l-accent bg-accent/10 text-accent-foreground",
                status === "joined" &&
                  "border-l-primary bg-primary/10 text-primary",
              )}
            >
              {status === "pre-join" && (
                <>
                  <Lock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span>
                    Buy-in not yet held. Funds are placed on hold once you
                    confirm.
                  </span>
                </>
              )}
              {status === "joining" && (
                <>
                  <CircleDollarSign
                    className="w-3.5 h-3.5 shrink-0 animate-pulse"
                    aria-hidden="true"
                  />
                  <span>Placing ${buyIn} on hold from your balance…</span>
                </>
              )}
              {status === "joined" && (
                <>
                  <Lock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span>
                    ${buyIn} held. Released or paid out after match finalization.
                  </span>
                </>
              )}
            </div>

            {/* Money + balance */}
            <div className="rounded-xl border bg-muted/40 p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Wallet className="w-4 h-4 text-primary" aria-hidden="true" />
                Buy-in &amp; Pot
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-muted-foreground">Your buy-in</span>
                <span className="text-2xl font-bold text-foreground">
                  ${buyIn}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Total pot ({match.max_participants} players)</span>
                <span className="font-semibold text-foreground">${totalPot}</span>
              </div>

              <Separator />

              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Available balance</span>
                  <span
                    className={cn(
                      "font-semibold tabular-nums",
                      insufficient ? "text-destructive" : "text-foreground",
                    )}
                  >
                    {balanceLoading ? "…" : `$${balance.toFixed(2)}`}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Balance after hold</span>
                  <span className="font-medium tabular-nums text-foreground">
                    {balanceLoading ? "…" : `$${balanceAfter.toFixed(2)}`}
                  </span>
                </div>
                {insufficient && (
                  <div className="flex items-start gap-2 mt-2 rounded-md bg-destructive/10 text-destructive p-2 text-[11px]">
                    <AlertTriangle
                      className="w-3.5 h-3.5 shrink-0 mt-0.5"
                      aria-hidden="true"
                    />
                    <span>
                      You need <strong>${(buyIn - balance).toFixed(2)}</strong>{" "}
                      more Play Money to join. Top up your balance and try again.
                    </span>
                  </div>
                )}
              </div>
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
                Winnings post once every player confirms the final scorecard
                (typically within 30 minutes of the last hole).
              </p>
            </div>

            {/* Forfeit / refund expectations */}
            <div className="rounded-xl border border-accent/30 bg-accent/5 p-4 space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <AlertTriangle
                  className="w-4 h-4 text-accent"
                  aria-hidden="true"
                />
                If you cancel or don't start
              </div>
              <ul className="text-xs text-muted-foreground space-y-1.5 list-disc pl-4">
                <li>
                  <strong className="text-foreground">
                    Cancel before tee time:
                  </strong>{" "}
                  full refund of your ${buyIn} hold, returned within minutes.
                </li>
                <li>
                  <strong className="text-foreground">
                    No-show after tee time:
                  </strong>{" "}
                  buy-in is forfeited and redistributed to players who completed
                  the round.
                </li>
                <li>
                  <strong className="text-foreground">
                    Quit mid-round:
                  </strong>{" "}
                  forfeit applies. Partial refunds may be granted at admin
                  discretion for documented emergencies.
                </li>
                <li>
                  <strong className="text-foreground">
                    Match cancelled by creator or weather:
                  </strong>{" "}
                  full refund to all players.
                </li>
              </ul>
            </div>

            {/* Short rules */}
            <div className="rounded-xl border p-4 space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <ScrollText className="w-4 h-4 text-primary" aria-hidden="true" />
                Match rules (summary)
              </div>
              <ul className="text-xs text-muted-foreground space-y-1 list-disc pl-4">
                <li>Skill-based competitive play — not gambling.</li>
                <li>Complete every hole to be eligible for payout.</li>
                <li>Forfeit applies if you leave or fail to start.</li>
                <li>Disputes are reviewed by Tyche admins.</li>
              </ul>
            </div>

            {/* Expandable full rules */}
            <Collapsible open={showFullRules} onOpenChange={setShowFullRules}>
              <CollapsibleTrigger className="w-full flex items-center justify-between rounded-xl border px-4 py-3 text-sm font-semibold hover:bg-muted/50 transition-colors">
                <span className="flex items-center gap-2">
                  <ScrollText
                    className="w-4 h-4 text-primary"
                    aria-hidden="true"
                  />
                  View full rules &amp; payout/dispute policy
                </span>
                <ChevronDown
                  className={cn(
                    "w-4 h-4 text-muted-foreground transition-transform",
                    showFullRules && "rotate-180",
                  )}
                  aria-hidden="true"
                />
              </CollapsibleTrigger>
              <CollapsibleContent className="rounded-xl border-x border-b -mt-px px-4 py-3 text-xs text-muted-foreground space-y-3">
                <section>
                  <h4 className="font-semibold text-foreground mb-1">
                    1. Eligibility &amp; conduct
                  </h4>
                  <p>
                    Players must be 18+ (or local minimum) and located in a
                    permitted region. Cheating, sandbagging, score manipulation,
                    collusion, or harassment will result in forfeiture and
                    possible permanent ban.
                  </p>
                </section>
                <section>
                  <h4 className="font-semibold text-foreground mb-1">
                    2. Buy-in &amp; holds
                  </h4>
                  <p>
                    On confirmation, your ${buyIn} buy-in is held from your Play
                    Money balance. The funds are not transferred to other
                    players — they remain on hold until the match is finalized
                    or refunded.
                  </p>
                </section>
                <section>
                  <h4 className="font-semibold text-foreground mb-1">
                    3. Cancellations &amp; refunds
                  </h4>
                  <p>
                    Cancel before tee time for a full automatic refund. Within
                    one hour of tee time, refunds require all opponents to
                    consent. After the match starts, your buy-in is at risk per
                    the forfeit rules above.
                  </p>
                </section>
                <section>
                  <h4 className="font-semibold text-foreground mb-1">
                    4. Scoring &amp; payouts
                  </h4>
                  <p>
                    All players must enter and confirm the final scorecard.
                    Payouts are calculated per the chosen format
                    ({formatLabel(match.format)}, {match.holes} holes) and
                    posted to the winner(s) within ~30 minutes of the last
                    confirmation.
                  </p>
                </section>
                <section>
                  <h4 className="font-semibold text-foreground mb-1">
                    5. Disputes
                  </h4>
                  <p>
                    Disputes must be filed within 24 hours of match completion.
                    Funds remain on hold pending review. Admin decisions are
                    final. False or repeated disputes may result in account
                    suspension.
                  </p>
                </section>
                <section>
                  <h4 className="font-semibold text-foreground mb-1">
                    6. Service availability
                  </h4>
                  <p>
                    Tyche is in pilot release in select regions. Features,
                    payouts, and limits may change. Service may be paused or
                    restricted at any time without prior notice.
                  </p>
                </section>
              </CollapsibleContent>
            </Collapsible>

            {/* Legal / eligibility disclaimer */}
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-destructive">
                <ShieldAlert className="w-4 h-4" aria-hidden="true" />
                Legal &amp; eligibility
              </div>
              <ul className="text-[11px] text-muted-foreground space-y-1 list-disc pl-4">
                <li>
                  Tyche is a <strong>pilot</strong> in select regions. Access
                  may be limited or revoked based on jurisdiction.
                </li>
                <li>
                  By joining, you confirm you are eligible to play in your
                  location and meet the minimum age requirement.
                </li>
                <li>
                  Misconduct (cheating, collusion, falsifying scores, abusive
                  behavior) may result in <strong>forfeiture of buy-in</strong>,
                  account suspension, or permanent ban.
                </li>
                <li>
                  Filing false disputes or repeatedly cancelling matches may
                  result in restrictions on your account.
                </li>
              </ul>
            </div>

            <Separator />

            <div className="flex items-start gap-2">
              <Checkbox
                id="confirm-join-terms"
                checked={agreed}
                onCheckedChange={(v) => setAgreed(v === true)}
                disabled={status === "joining" || insufficient}
              />
              <Label
                htmlFor="confirm-join-terms"
                className="text-xs leading-relaxed cursor-pointer"
              >
                I'm eligible to play, agree to the full rules &amp; dispute
                policy, and authorize <strong>${buyIn}</strong> to be held from
                my Play Money balance.
              </Label>
            </div>
          </div>
        </ScrollArea>

        <AlertDialogFooter className="px-6 pb-6 pt-2 border-t">
          <AlertDialogCancel disabled={status === "joining"}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={!agreed || status !== "pre-join" || insufficient}
            className="bg-primary text-primary-foreground hover:opacity-90"
          >
            {status === "joining"
              ? "Holding funds…"
              : status === "joined"
                ? "Joined ✓"
                : insufficient
                  ? "Insufficient balance"
                  : `Confirm & Join`}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default JoinMatchConfirmDialog;
