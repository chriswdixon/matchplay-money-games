import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Crown, CheckCircle, ExternalLink, CreditCard, RefreshCw } from "lucide-react";
import { useSubscription, SUBSCRIPTION_TIERS } from "@/hooks/useSubscription";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

const SubscriptionManagement = () => {
  const { subscribed, tierName, subscriptionEnd, loading, refreshSubscription } = useSubscription();
  const { toast } = useToast();
  const [portalLoading, setPortalLoading] = useState(false);
  const [upgradeLoading, setUpgradeLoading] = useState(false);

  const handleManageBilling = async () => {
    setPortalLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const { data, error } = await supabase.functions.invoke('customer-portal', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;

      if (data?.url) {
        window.open(data.url, '_blank');
        toast({
          title: "Opening billing portal",
          description: "Manage your subscription in the new tab",
        });
      }
    } catch (error) {
      console.error('Error opening portal:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to open billing portal",
        variant: "destructive",
      });
    } finally {
      setPortalLoading(false);
    }
  };

  const handleUpgrade = async (priceId: string) => {
    setUpgradeLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: { priceId },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;

      if (data?.url) {
        window.open(data.url, '_blank');
        toast({
          title: "Redirecting to checkout",
          description: "Complete your upgrade in the new tab",
        });
      }
    } catch (error) {
      console.error('Error creating checkout:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create checkout",
        variant: "destructive",
      });
    } finally {
      setUpgradeLoading(false);
    }
  };

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
    'Local Player': [
      "Local match booking",
      "GPS-based player matching",
      "Handicap tracking & management",
      "Friendly money games",
      "Live scoring system",
      "Instant payouts",
      "Basic match history"
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

  const isLocalTier = tierName === 'Local Player';

  return (
    <div className="max-w-[1400px] mx-auto space-y-6">
      {/* Current Subscription */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                Current Subscription
                {subscribed && !isLocalTier && <Crown className="w-5 h-5 text-accent" />}
              </CardTitle>
              <CardDescription>Manage your membership and billing</CardDescription>
            </div>
            {subscribed && (
              <Badge className={isLocalTier ? "bg-primary/10" : "bg-accent/10"}>
                {tierName}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {!subscribed ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-4">No active subscription</p>
              <Button onClick={() => handleUpgrade(SUBSCRIPTION_TIERS.local.price_id)}>
                Subscribe to Local Player
              </Button>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <h4 className="font-medium">Your Features</h4>
                <ul className="space-y-2">
                  {(tierFeatures[tierName as keyof typeof tierFeatures] || tierFeatures['Local Player']).map((feature, idx) => (
                    <li key={idx} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <CheckCircle className="w-4 h-4 text-accent" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>

              {subscriptionEnd && (
                <div className="pt-4 border-t">
                  <p className="text-sm text-muted-foreground">
                    Next billing date: {new Date(subscriptionEnd).toLocaleDateString()}
                  </p>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                {isLocalTier && (
                  <Button onClick={() => handleUpgrade(SUBSCRIPTION_TIERS.tournament.price_id)} className="flex-1" disabled={upgradeLoading}>
                    <Crown className="w-4 h-4 mr-2" />
                    {upgradeLoading ? "Processing..." : "Upgrade to Tournament Pro"}
                  </Button>
                )}
                <Button onClick={refreshSubscription} variant="outline" size="icon">
                  <RefreshCw className="w-4 h-4" />
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Billing & Card Management */}
      {subscribed && (
        <Card>
          <CardHeader>
            <CardTitle>Billing & Payment</CardTitle>
            <CardDescription>Manage your payment method and view billing history</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button variant="outline" className="w-full" onClick={handleManageBilling} disabled={portalLoading}>
              <CreditCard className="w-4 h-4 mr-2" />
              {portalLoading ? "Loading..." : "Manage Payment Method"}
            </Button>
            <p className="text-sm text-muted-foreground text-center">
              Update your credit card, view invoices, and manage your subscription
            </p>
          </CardContent>
        </Card>
      )}

      {/* Available Upgrades */}
      {subscribed && isLocalTier && (
        <Card>
          <CardHeader>
            <CardTitle>Upgrade to Tournament Pro</CardTitle>
            <CardDescription>Unlock premium features for serious competitors</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 border rounded-lg space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold flex items-center gap-2">
                  <Crown className="w-5 h-5 text-accent" />
                  Tournament Pro
                </h4>
                <Badge variant="secondary">$79/month</Badge>
              </div>
              <ul className="space-y-1 text-sm text-muted-foreground">
                {tierFeatures['Tournament Pro'].slice(1).map((feature, idx) => (
                  <li key={idx} className="flex items-center gap-2">
                    <CheckCircle className="w-3 h-3 text-accent" />
                    {feature}
                  </li>
                ))}
              </ul>
              <Button 
                onClick={() => handleUpgrade(SUBSCRIPTION_TIERS.tournament.price_id)} 
                size="sm" 
                className="w-full"
                disabled={upgradeLoading}
              >
                {upgradeLoading ? "Processing..." : "Upgrade Now"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default SubscriptionManagement;
