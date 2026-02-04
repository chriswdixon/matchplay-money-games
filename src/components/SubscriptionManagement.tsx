import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Crown, CheckCircle, Star, Zap, Wallet } from "lucide-react";
import { useSubscription } from "@/hooks/useSubscription";

interface SubscriptionManagementProps {
  isVerified?: boolean;
  onRequestVerification?: () => void;
}

const SubscriptionManagement = ({ isVerified = false }: SubscriptionManagementProps) => {
  const { tierName, loading } = useSubscription();

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
    <div className="max-w-[1400px] mx-auto space-y-6">
      {/* Current Subscription */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                Current Subscription
                {isFreeTier && <Zap className="w-5 h-5 text-muted-foreground" />}
                {isLocalTier && <Star className="w-5 h-5 text-primary" />}
                {isTournamentTier && <Crown className="w-5 h-5 text-accent" />}
              </CardTitle>
              <CardDescription>Your membership details</CardDescription>
            </div>
            <Badge className={isFreeTier ? "bg-muted-foreground/20 text-foreground" : (isLocalTier ? "bg-primary/10 text-foreground" : "bg-accent/10 text-foreground")}>
              {tierName}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <h4 className="font-medium">Your Features</h4>
            <ul className="space-y-2">
              {(tierFeatures[tierName as keyof typeof tierFeatures] || tierFeatures['Free']).map((feature, idx) => (
                <li key={idx} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CheckCircle className="w-4 h-4 text-accent" />
                  {feature}
                </li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Play Money Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="w-5 h-5 text-primary" />
            Play Money System
          </CardTitle>
          <CardDescription>How the play money system works</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 bg-muted/50 rounded-lg space-y-3">
            <p className="text-sm text-muted-foreground">
              All matches use <strong>play money</strong> instead of real currency. New accounts start with $500 in play money.
            </p>
            <ul className="space-y-1 text-sm text-muted-foreground list-disc list-inside">
              <li>Match buy-ins are deducted from your balance</li>
              <li>Win matches to earn more play money</li>
              <li>Climb the leaderboard by accumulating winnings</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SubscriptionManagement;
