import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Crown, CheckCircle, Star, Zap, Wallet, ArrowUpCircle } from "lucide-react";
import { useSubscription } from "@/hooks/useSubscription";
import { useNavigate } from "react-router-dom";

interface SubscriptionManagementProps {
  isVerified?: boolean;
  onRequestVerification?: () => void;
}

const SubscriptionManagement = ({ isVerified = false }: SubscriptionManagementProps) => {
  const { tierName, loading } = useSubscription();
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Loading subscription details...</p>
        </div>
      </div>
    );
  }

  const tierFeatures = {
    'Free': [
      "Basic match booking",
      "Local player matching",
      "Simple handicap tracking",
      "Live scoring",
      "Match history",
      "$500 starting play money"
    ],
    'Local Player': [
      "Everything in Free",
      "GPS-based player matching",
      "Advanced handicap management",
      "Friendly money games",
      "Instant payouts",
      "Detailed match history"
    ],
    'Tournament Pro': [
      "Everything in Local Player",
      "Seasonal leaderboard access",
      "Host & create tournaments",
      "Tournament entry incentives",
      "Advanced handicap analytics",
      "Priority match placement",
      "Tournament history & stats",
      "Premium customer support"
    ]
  };

  const isFreeTier = tierName === 'Free';
  const isLocalTier = tierName === 'Local Player';
  const isTournamentTier = tierName === 'Tournament Pro';

  return (
    <div className="space-y-8">
      {/* Current Subscription */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <h2 className="flex items-center gap-2 text-lg font-semibold leading-none tracking-tight">
              Your Membership
              {isFreeTier && <Zap className="w-5 h-5 text-muted-foreground" />}
              {isLocalTier && <Star className="w-5 h-5 text-primary" />}
              {isTournamentTier && <Crown className="w-5 h-5 text-accent" />}
              <Badge className={isFreeTier ? "bg-muted-foreground/20 text-foreground" : (isLocalTier ? "bg-primary/10 text-foreground" : "bg-accent/10 text-foreground")}>
                {tierName}
              </Badge>
            </h2>
            <p className="text-sm text-muted-foreground">
              {isFreeTier && "You're on the free plan. Upgrade to unlock GPS matching and more."}
              {isLocalTier && "You have access to GPS matching, advanced handicaps, and instant payouts."}
              {isTournamentTier && "You have full access — tournaments, leaderboards, and premium support."}
            </p>
          </div>
          {!isTournamentTier && (
            <Button
              size="sm"
              onClick={() => navigate('/#membership')}
              className="gap-2"
            >
              <ArrowUpCircle className="w-4 h-4" aria-hidden="true" />
              {isFreeTier ? 'Upgrade Plan' : 'Upgrade to Pro'}
            </Button>
          )}
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">What's included</p>
          <ul className="space-y-2">
            {(tierFeatures[tierName as keyof typeof tierFeatures] || tierFeatures['Free']).map((feature, idx) => (
              <li key={idx} className="flex items-start gap-2 text-sm text-foreground">
                <CheckCircle className="w-4 h-4 text-accent mt-0.5 shrink-0" />
                <span>{feature}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Play Money Info */}
      <div className="space-y-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold leading-none tracking-tight">
          <Wallet className="w-5 h-5 text-primary" />
          How Play Money Works
        </h2>
        <div className="p-4 bg-muted/50 rounded-lg space-y-3">
          <p className="text-sm text-muted-foreground">
            Tyche is 100% play money — no real currency changes hands. Every new account starts with{' '}
            <strong className="text-foreground">$500</strong> to enter matches.
          </p>
          <ul className="space-y-1.5 text-sm text-muted-foreground list-disc list-inside marker:text-primary">
            <li>Entry fees are held until the match finishes</li>
            <li>Winners take the prize pool — losses come out of your balance</li>
            <li>Climb the leaderboard by stacking wins over time</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default SubscriptionManagement;
