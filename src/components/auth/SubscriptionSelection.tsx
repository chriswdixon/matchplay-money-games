import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, Star, Crown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { SUBSCRIPTION_TIERS } from '@/hooks/useSubscription';

interface SubscriptionSelectionProps {
  onComplete: () => void;
}

export function SubscriptionSelection({ onComplete }: SubscriptionSelectionProps) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const tiers = [
    {
      key: 'local_annual' as const,
      name: "Local Player",
      price: "$49",
      period: "/year",
      monthlyPrice: "or $59/mo",
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
    },
    {
      key: 'tournament_annual' as const,
      name: "Tournament Pro",
      price: "$99",
      period: "/year",
      monthlyPrice: "or $109/mo",
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
    }
  ];

  const handleSubscribe = async (tierKey: 'local_annual' | 'local_monthly' | 'tournament_annual' | 'tournament_monthly') => {
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

      <div className="grid md:grid-cols-2 gap-6">
        {tiers.map((tier) => (
          <Card 
            key={tier.key}
            className={`relative transition-all duration-300 hover:shadow-lg ${
              tier.popular 
                ? 'border-accent shadow-md scale-105' 
                : 'border-border hover:border-primary/30'
            }`}
          >
            {tier.popular && (
              <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-accent text-accent-foreground shadow-md border-0">
                Most Popular
              </Badge>
            )}
            
            <CardHeader className="text-center pb-4">
              <div className={`w-12 h-12 mx-auto mb-4 rounded-full flex items-center justify-center ${
                tier.popular ? 'bg-accent text-accent-foreground' : 'bg-primary/10 text-primary'
              }`}>
                {tier.icon}
              </div>
              <CardTitle className="text-2xl font-bold">{tier.name}</CardTitle>
              <CardDescription>{tier.description}</CardDescription>
              <div className="flex flex-col items-center mt-4">
                <div className="flex items-baseline">
                  <span className={`text-4xl font-bold ${
                    tier.popular ? 'text-accent' : 'text-primary'
                  }`}>
                    {tier.price}
                  </span>
                  <span className="text-muted-foreground ml-1">{tier.period}</span>
                </div>
                {'monthlyPrice' in tier && tier.monthlyPrice && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {tier.monthlyPrice}
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
                      tier.popular ? 'text-accent' : 'text-success'
                    }`} />
                    <span className="text-sm">{feature}</span>
                  </li>
                ))}
              </ul>
              
              <Button 
                onClick={() => handleSubscribe(tier.key)}
                disabled={loading}
                className="w-full bg-yellow-500 hover:bg-yellow-600 text-white"
                size="lg"
              >
                {loading ? "Processing..." : `Start ${tier.name} Trial`}
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
