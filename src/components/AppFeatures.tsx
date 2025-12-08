import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Smartphone, 
  MapPin, 
  Calculator, 
  Handshake, 
  CreditCard, 
  Shield,
  Trophy,
  BarChart3,
  Users,
  Zap,
  Target,
  Clock
} from "lucide-react";

const AppFeatures = () => {
  const coreFeatures = [
    {
      icon: <Smartphone className="w-8 h-8" />,
      title: "Booking Service",
      description: "Seamlessly book tee times and reserve spots for competitive matches at courses in your area",
      benefits: ["Real-time availability", "Instant confirmation", "Course integration"]
    },
    {
      icon: <Calculator className="w-8 h-8" />,
      title: "True Handicap System",
      description: "More accurate than USGA because every stroke counts in competitive play - no cheating possible",
      benefits: ["Competition accuracy", "Live tracking", "Trend analysis"]
    },
    {
      icon: <Handshake className="w-8 h-8" />,
      title: "Smart Matchmaking",
      description: "Find compatible players based on skill level, location, and preferred game formats",
      benefits: ["GPS-based matching", "Skill compatibility", "Game preferences"]
    },
    {
      icon: <CreditCard className="w-8 h-8" />,
      title: "Secure Entry Fees & Prizes",
      description: "Bank-level security for all transactions with instant prize distribution to winners",
      benefits: ["Instant settlements", "Secure escrow", "Transaction history"]
    },
    {
      icon: <MapPin className="w-8 h-8" />,
      title: "GPS Course Integration",
      description: "Real-time location services and course mapping for accurate play tracking",
      benefits: ["Live scoring zones", "Course navigation", "Distance tracking"]
    }
  ];

  const additionalFeatures = [
    { icon: <Shield className="w-6 h-6" />, title: "Dispute Resolution", desc: "Automated scoring prevents disputes" },
    { icon: <Trophy className="w-6 h-6" />, title: "Tournament Hosting", desc: "Create and manage your own events" },
    { icon: <BarChart3 className="w-6 h-6" />, title: "Performance Analytics", desc: "Track improvement over time" },
    { icon: <Users className="w-6 h-6" />, title: "Player Verification", desc: "Vetted member community" },
    { icon: <Zap className="w-6 h-6" />, title: "Live Scoring", desc: "Real-time match updates" },
    { icon: <Target className="w-6 h-6" />, title: "Game Formats", desc: "Stroke play, match play, best ball, scramble" },
    { icon: <Clock className="w-6 h-6" />, title: "Flexible Scheduling", desc: "Book matches anytime" },
    { icon: <CreditCard className="w-6 h-6" />, title: "Multiple Payment", desc: "Various deposit methods" }
  ];

  return (
    <section className="py-20 px-6 bg-muted/30">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16 animate-fade-in">
          <Badge className="mb-4 bg-primary/10 text-primary border-primary/20">
            🚀 Platform Features
          </Badge>
          <h2 className="text-4xl md:text-5xl font-bold mb-6 text-foreground">
            Five Services, One Platform
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            MatchPlay combines the best of GolfNow, 18Birdies, Venmo, and GHIN 
            into one seamless competitive golf experience.
          </p>
        </div>

        {/* Core Features Grid */}
        <div className="grid lg:grid-cols-3 gap-8 mb-16">
          {coreFeatures.map((feature, index) => (
            <Card 
              key={feature.title}
              className="border-border hover:border-primary/30 transition-all duration-300 hover:shadow-card animate-slide-up bg-card"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <CardHeader className="pb-4">
                <div className="w-16 h-16 bg-gradient-primary text-primary-foreground rounded-2xl flex items-center justify-center mb-4">
                  {feature.icon}
                </div>
                <CardTitle className="text-xl font-bold text-foreground">
                  {feature.title}
                </CardTitle>
                <CardDescription className="text-muted-foreground">
                  {feature.description}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {feature.benefits.map((benefit, benefitIndex) => (
                    <li key={benefitIndex} className="flex items-center gap-2 text-sm">
                      <div className="w-1.5 h-1.5 bg-primary rounded-full flex-shrink-0"></div>
                      <span className="text-foreground">{benefit}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Additional Features */}
        <div className="bg-card rounded-2xl p-8 md:p-12 shadow-card">
          <h3 className="text-2xl font-bold text-center mb-8 text-foreground">
            Plus Everything Else You Need
          </h3>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {additionalFeatures.map((feature, index) => (
              <div 
                key={feature.title}
                className="flex items-start gap-3 animate-fade-in"
                style={{ animationDelay: `${index * 0.05}s` }}
              >
                <div className="w-10 h-10 bg-gradient-primary text-primary-foreground rounded-xl flex items-center justify-center flex-shrink-0">
                  {feature.icon}
                </div>
                <div>
                  <h4 className="font-semibold text-foreground text-sm">{feature.title}</h4>
                  <p className="text-xs text-muted-foreground mt-1">{feature.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Competitive Advantage */}
        <div className="mt-16 text-center">
          <div className="bg-gradient-hero text-white rounded-2xl p-8 md:p-12">
            <h3 className="text-3xl font-bold mb-4">The Competitive Edge</h3>
            <p className="text-xl mb-6 text-white/90 max-w-2xl mx-auto">
              "Because these are competitive matches with real stakes, the scoring is way more accurate. 
              You can't cheat your score - creating the truest handicap system ever built."
            </p>
            <div className="grid sm:grid-cols-3 gap-6 mt-8">
              <div className="text-center">
                <div className="text-2xl font-bold text-accent mb-2">100%</div>
                <div className="text-sm text-white/80">Accurate Scoring</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-accent mb-2">0</div>
                <div className="text-sm text-white/80">Payment Disputes</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-accent mb-2">Instant</div>
                <div className="text-sm text-white/80">Prize Distribution</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default AppFeatures;