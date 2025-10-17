import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Check, Star, Crown } from "lucide-react";
import { useState } from "react";

const MembershipTiers = () => {
  const [billingPeriod, setBillingPeriod] = useState<"annual" | "monthly">("annual");

  const tiers = [
    {
      name: "Free",
      price: "$0",
      period: "/year",
      description: "Perfect for getting started",
      features: [
        "Basic match booking",
        "Local player matching",
        "Simple handicap tracking",
        "Live scoring",
        "Match history"
      ],
      buttonText: "Start Free",
      popular: false,
      icon: <Star className="w-6 h-6" />,
      colorScheme: "secondary",
      showTabs: false
    },
    {
      name: "Local Player",
      annualPrice: "$49",
      monthlyPrice: "$59",
      annualTotal: "$588",
      description: "Perfect for casual competitive play",
      features: [
        "Everything in Free",
        "GPS-based player matching",
        "Advanced handicap management",
        "Friendly money games",
        "Instant payouts",
        "Detailed match history"
      ],
      buttonText: "Start Local Play",
      popular: true,
      icon: <Star className="w-6 h-6" />,
      colorScheme: "primary",
      showTabs: true
    },
    {
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
      buttonText: "Join Tournament Circuit",
      popular: false,
      icon: <Crown className="w-6 h-6" />,
      colorScheme: "warning",
      showTabs: true
    }
  ];

  return (
    <section className="py-20 px-6 bg-gradient-card">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16 animate-fade-in">
          <Badge className="mb-4 bg-primary/10 text-primary border-primary/20">
            💳 Membership Plans
          </Badge>
          <h2 className="text-4xl md:text-5xl font-bold mb-6 text-foreground">
            Choose Your Game Level
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Two tiers designed for every type of competitive golfer. 
            Start local or go pro with tournament access.
          </p>
        </div>
        
        <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {tiers.map((tier, index) => (
            <Card 
              key={tier.name} 
              className={`relative transition-all duration-300 hover:shadow-premium animate-slide-up ${
                tier.popular 
                  ? 'border-primary shadow-premium bg-gradient-card scale-105' 
                  : tier.colorScheme === 'warning'
                  ? 'border-warning shadow-premium'
                  : 'border-border hover:border-primary/30'
              }`}
              style={{ animationDelay: `${index * 0.1}s` }}
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
                <CardTitle className="text-2xl font-bold text-foreground">{tier.name}</CardTitle>
                <CardDescription className="text-muted-foreground">{tier.description}</CardDescription>
                
                {tier.showTabs && (
                  <div className="mt-4">
                    <Tabs value={billingPeriod} onValueChange={(value) => setBillingPeriod(value as "annual" | "monthly")} className="w-full">
                      <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="annual">Annual</TabsTrigger>
                        <TabsTrigger value="monthly">Monthly</TabsTrigger>
                      </TabsList>
                    </Tabs>
                  </div>
                )}
                
                <div className="flex flex-col items-center mt-4">
                  <div className="flex items-baseline">
                    <span className={`text-5xl font-bold ${
                      tier.colorScheme === 'primary' ? 'text-primary' :
                      tier.colorScheme === 'warning' ? 'text-warning' :
                      'text-muted-foreground'
                    }`}>
                      {tier.showTabs 
                        ? (billingPeriod === "annual" ? tier.annualPrice : tier.monthlyPrice)
                        : tier.price
                      }
                    </span>
                    <span className="text-muted-foreground ml-1">/mo</span>
                  </div>
                  {tier.showTabs && billingPeriod === "annual" && (
                    <p className="text-sm text-muted-foreground mt-2">
                      billed annually at {tier.annualTotal}
                    </p>
                  )}
                  {!tier.showTabs && 'period' in tier && (
                    <span className="text-sm text-muted-foreground mt-2">Forever free</span>
                  )}
                </div>
              </CardHeader>
              
              <CardContent className="pb-6">
                <ul className="space-y-3">
                  {tier.features.map((feature, featureIndex) => (
                    <li key={featureIndex} className="flex items-start gap-3">
                      <Check className={`w-5 h-5 mt-0.5 flex-shrink-0 ${
                        tier.colorScheme === 'primary' ? 'text-primary' :
                        tier.colorScheme === 'warning' ? 'text-warning' :
                        'text-muted-foreground'
                      }`} />
                      <span className="text-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
              
              <CardFooter>
                <Button 
                  className={`w-full transform hover:scale-105 transition-all duration-300 ${
                    tier.colorScheme === 'primary' ? 'bg-primary hover:bg-primary/90 text-primary-foreground' :
                    tier.colorScheme === 'warning' ? 'bg-warning hover:bg-warning/90 text-warning-foreground' :
                    'bg-secondary hover:bg-secondary/80 text-secondary-foreground'
                  }`}
                  size="lg"
                >
                  {tier.buttonText}
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
        
        <div className="text-center mt-12 p-6 bg-muted/50 rounded-2xl max-w-2xl mx-auto">
          <p className="text-sm text-muted-foreground">
            🔒 All transactions are protected by bank-level security. Cancel anytime.
          </p>
        </div>
      </div>
    </section>
  );
};

export default MembershipTiers;