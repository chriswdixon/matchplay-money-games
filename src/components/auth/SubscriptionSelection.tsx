import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Check, Star, Crown, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { SUBSCRIPTION_TIERS } from '@/hooks/useSubscription';
import { isOver21 } from '@/lib/validation';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { usePrivateProfile } from '@/hooks/usePrivateProfile';

interface SubscriptionSelectionProps {
  onComplete: () => void;
}

export function SubscriptionSelection({ onComplete }: SubscriptionSelectionProps) {
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [userAge21Plus, setUserAge21Plus] = useState<boolean | null>(null);
  
  // Get tier and billing from URL params
  const urlTier = searchParams.get('tier');
  const urlBilling = searchParams.get('billing') as "annual" | "monthly" | null;
  
  // Set initial billing period based on URL or default to annual
  const [billingPeriod, setBillingPeriod] = useState<"annual" | "monthly">(
    urlBilling || "annual"
  );
  
  const { toast } = useToast();
  const { privateData, loading: privateDataLoading } = usePrivateProfile();

  useEffect(() => {
    if (privateData?.date_of_birth) {
      setUserAge21Plus(isOver21(privateData.date_of_birth));
    }
  }, [privateData]);

  const tiers = [
    {
      key: 'local_annual' as const,
      monthlyKey: 'local_monthly' as const,
      tierName: 'local',
      name: "Local Player",
      annualPrice: "$49",
      monthlyPrice: "$59",
      annualTotal: "$588",
      description: "Perfect for casual competitive play",
      features: [
        "GPS-based player matching",
        "Advanced handicap management",
        "Friendly money games",
        "Instant payouts",
        "Detailed match history"
      ],
      icon: <Star className="w-6 h-6" />,
      popular: true,
      colorScheme: "primary" as const,
    },
    {
      key: 'tournament_annual' as const,
      monthlyKey: 'tournament_monthly' as const,
      tierName: 'tournament',
      name: "Tournament Pro",
      annualPrice: "$99",
      monthlyPrice: "$109",
      annualTotal: "$1,188",
      description: "For serious competitors who want it all",
      features: [
        "Everything in Local Player",
        "Seasonal leaderboard access",
        "Host & create tournaments",
        "Tournament entry incentives",
        "Advanced handicap analytics",
        "Priority match placement",
        "Tournament history & stats",
        "Premium customer support"
      ],
      icon: <Crown className="w-6 h-6" />,
      popular: false,
      colorScheme: "warning" as const,
    }
  ];

  // Filter tiers based on URL parameter if present
  const displayTiers = urlTier 
    ? tiers.filter(tier => tier.tierName === urlTier)
    : tiers;

  const handleSubscribe = async (tierKey: 'local_annual' | 'local_monthly' | 'tournament_annual' | 'tournament_monthly') => {
    // Check age requirement for paid subscriptions
    if (userAge21Plus === false) {
      toast({
        title: "Age Requirement Not Met",
        description: "You must be 21 or older to purchase a paid subscription.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      const priceId = SUBSCRIPTION_TIERS[tierKey].price_id;

      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: { priceId },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;

      if (data?.url) {
        // Open Stripe checkout in new tab
        window.open(data.url, '_blank');
        
        toast({
          title: "Redirecting to payment",
          description: "Complete your subscription in the new tab. You'll have a 7-day trial!",
        });

        // After opening checkout, mark as complete
        // User can close the modal or continue
        setTimeout(() => {
          onComplete();
        }, 2000);
      }
    } catch (error) {
      console.error('Error creating checkout:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create checkout session",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <Badge className="mb-4 bg-primary/10 text-primary border-primary/20">
          💳 Choose Your Plan
        </Badge>
        <h2 className="text-3xl font-bold mb-2">
          Complete Your Registration
        </h2>
        <p className="text-muted-foreground">
          Select a plan to start your 7-day free trial. Cancel anytime.
        </p>
      </div>

      {userAge21Plus === false && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Paid subscriptions require users to be 21 years or older. You are currently restricted to the free tier.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        {displayTiers.map((tier) => (
          <Card 
            key={tier.key}
            className={`relative transition-all duration-300 hover:shadow-lg ${
              tier.popular 
                ? 'border-primary shadow-premium scale-105' 
                : 'border-warning shadow-premium'
            }`}
          >
            {tier.popular && (
              <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground shadow-premium border-0">
                Most Popular
              </Badge>
            )}
            
            <CardHeader className="text-center pb-4">
              <div className={`w-12 h-12 mx-auto mb-4 rounded-full flex items-center justify-center ${
                tier.colorScheme === 'primary' ? 'bg-primary text-primary-foreground' :
                tier.colorScheme === 'warning' ? 'bg-warning text-warning-foreground' :
                'bg-secondary text-secondary-foreground'
              }`}>
                {tier.icon}
              </div>
              <CardTitle className="text-2xl font-bold">{tier.name}</CardTitle>
              <CardDescription>{tier.description}</CardDescription>
              
              <div className="mt-4">
                <Tabs value={billingPeriod} onValueChange={(value) => setBillingPeriod(value as "annual" | "monthly")} className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="annual">Annual</TabsTrigger>
                    <TabsTrigger value="monthly">Monthly</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
              
              <div className="flex flex-col items-center mt-4">
                <div className="flex items-baseline">
                  <span className={`text-4xl font-bold ${
                    tier.colorScheme === 'primary' ? 'text-primary' :
                    tier.colorScheme === 'warning' ? 'text-warning' :
                    'text-muted-foreground'
                  }`}>
                    {billingPeriod === "annual" ? tier.annualPrice : tier.monthlyPrice}
                  </span>
                  <span className="text-muted-foreground ml-1">/mo</span>
                </div>
                {billingPeriod === "annual" && (
                  <p className="text-sm text-muted-foreground mt-1">
                    billed annually at {tier.annualTotal}
                  </p>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                7-day free trial included
              </p>
            </CardHeader>
            
            <CardContent className="pb-6">
              <ul className="space-y-3 mb-6">
                {tier.features.map((feature, featureIndex) => (
                  <li key={featureIndex} className="flex items-start gap-3">
                    <Check className={`w-5 h-5 mt-0.5 flex-shrink-0 ${
                      tier.colorScheme === 'primary' ? 'text-primary' :
                      tier.colorScheme === 'warning' ? 'text-warning' :
                      'text-muted-foreground'
                    }`} />
                    <span className="text-sm">{feature}</span>
                  </li>
                ))}
              </ul>
              
              <Button 
                onClick={() => handleSubscribe(billingPeriod === "annual" ? tier.key : tier.monthlyKey)}
                disabled={loading || privateDataLoading || userAge21Plus === false}
                className={`w-full transform hover:scale-105 transition-all duration-300 disabled:opacity-50 ${
                  tier.colorScheme === 'primary' ? 'bg-primary hover:bg-primary/90 text-primary-foreground' :
                  tier.colorScheme === 'warning' ? 'bg-warning hover:bg-warning/90 text-warning-foreground' :
                  'bg-secondary hover:bg-secondary/80 text-secondary-foreground'
                }`}
                size="lg"
              >
                {loading ? "Processing..." : userAge21Plus === false ? "Age 21+ Required" : `Start ${tier.name} Trial`}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="text-center p-4 bg-muted/50 rounded-lg">
        <p className="text-sm text-muted-foreground">
          🔒 <strong>Secure Payment:</strong> All transactions protected by Stripe
        </p>
        <p className="text-sm text-muted-foreground mt-1">
          You can cancel anytime during your trial with no charge
        </p>
      </div>
    </div>
  );
}
