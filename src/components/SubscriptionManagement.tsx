import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Crown, CheckCircle, ExternalLink } from "lucide-react";
import { useProfile } from "@/hooks/useProfile";
import { toast } from "sonner";

const SubscriptionManagement = () => {
  const { profile } = useProfile();

  const handleUpgrade = () => {
    toast.info("Upgrade feature coming soon!");
  };

  const handleManageBilling = () => {
    toast.info("Billing portal coming soon!");
  };

  const tierFeatures = {
    local: [
      "Create and join local matches",
      "Basic match features",
      "Community access"
    ],
    regional: [
      "All Local features",
      "Regional match access",
      "Advanced filters",
      "Priority support"
    ],
    national: [
      "All Regional features",
      "National match network",
      "Premium features",
      "VIP support",
      "Exclusive events"
    ]
  };

  const currentTier = profile?.membership_tier || 'local';
  const tierColors = {
    local: "bg-muted",
    regional: "bg-primary/10",
    national: "bg-accent/10"
  };

  return (
    <div className="space-y-6">
      {/* Current Subscription */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                Current Subscription
                {currentTier !== 'local' && <Crown className="w-5 h-5 text-accent" />}
              </CardTitle>
              <CardDescription>Manage your membership and billing</CardDescription>
            </div>
            <Badge className={tierColors[currentTier as keyof typeof tierColors]}>
              {currentTier.charAt(0).toUpperCase() + currentTier.slice(1)}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <h4 className="font-medium">Your Features</h4>
            <ul className="space-y-2">
              {tierFeatures[currentTier as keyof typeof tierFeatures].map((feature, idx) => (
                <li key={idx} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CheckCircle className="w-4 h-4 text-accent" />
                  {feature}
                </li>
              ))}
            </ul>
          </div>

          {currentTier !== 'national' && (
            <Button onClick={handleUpgrade} className="w-full">
              <Crown className="w-4 h-4 mr-2" />
              Upgrade Plan
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Billing */}
      <Card>
        <CardHeader>
          <CardTitle>Billing Information</CardTitle>
          <CardDescription>Manage your payment methods and invoices</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button variant="outline" className="w-full" onClick={handleManageBilling}>
            <ExternalLink className="w-4 h-4 mr-2" />
            Manage Billing Portal
          </Button>
        </CardContent>
      </Card>

      {/* Upgrade Options */}
      {currentTier !== 'national' && (
        <Card>
          <CardHeader>
            <CardTitle>Available Upgrades</CardTitle>
            <CardDescription>Choose the plan that fits your needs</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {currentTier === 'local' && (
              <div className="p-4 border rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold">Regional Membership</h4>
                  <Badge variant="secondary">$29/month</Badge>
                </div>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  {tierFeatures.regional.slice(1).map((feature, idx) => (
                    <li key={idx} className="flex items-center gap-2">
                      <CheckCircle className="w-3 h-3 text-accent" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <Button onClick={handleUpgrade} size="sm" className="w-full">
                  Upgrade to Regional
                </Button>
              </div>
            )}
            
            <div className="p-4 border rounded-lg space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold">National Membership</h4>
                <Badge variant="secondary">$79/month</Badge>
              </div>
              <ul className="space-y-1 text-sm text-muted-foreground">
                {tierFeatures.national.slice(1).map((feature, idx) => (
                  <li key={idx} className="flex items-center gap-2">
                    <CheckCircle className="w-3 h-3 text-accent" />
                    {feature}
                  </li>
                ))}
              </ul>
              <Button onClick={handleUpgrade} size="sm" className="w-full">
                Upgrade to National
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default SubscriptionManagement;
