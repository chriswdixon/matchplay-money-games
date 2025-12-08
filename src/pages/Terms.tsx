import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Shield, Users, Trophy, Scale } from "lucide-react";
import { Link } from "react-router-dom";

const Terms = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container flex h-16 items-center justify-between px-4">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/" className="flex items-center gap-2">
              <ArrowLeft className="w-4 h-4" />
              Back to MatchPlay
            </Link>
          </Button>
        </div>
      </header>

      <main className="container py-12 px-4 max-w-4xl">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4 text-foreground">Terms of Service</h1>
          <p className="text-lg text-muted-foreground">
            Last updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </p>
        </div>

        {/* Key Points Cards */}
        <div className="grid md:grid-cols-2 gap-4 mb-12">
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Trophy className="w-5 h-5 text-primary" />
                Skill-Based Competition
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                MatchPlay facilitates skill-based golf competitions where outcomes are determined by player performance, not chance.
              </p>
            </CardContent>
          </Card>

          <Card className="border-primary/20 bg-primary/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Shield className="w-5 h-5 text-primary" />
                Secure Platform
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                All entry fees are held securely in escrow until competition completion, with transparent prize distribution.
              </p>
            </CardContent>
          </Card>

          <Card className="border-primary/20 bg-primary/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" />
                Player Accountability
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Real-time scoring and peer verification ensure fair play and accurate handicap tracking.
              </p>
            </CardContent>
          </Card>

          <Card className="border-primary/20 bg-primary/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Scale className="w-5 h-5 text-primary" />
                Fair Competition
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Handicap-adjusted scoring levels the playing field for competitors of all skill levels.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Terms Content */}
        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-8">
          <section>
            <h2 className="text-2xl font-semibold text-foreground border-b pb-2">1. Platform Overview</h2>
            <p className="text-muted-foreground mt-4">
              MatchPlay ("Platform," "we," "us," or "our") is a competitive golf platform that enables players to participate in skill-based golf competitions. The Platform facilitates match organization, real-time scoring, handicap tracking, and prize distribution for golf competitions.
            </p>
            <p className="text-muted-foreground">
              Our services are designed for recreational golfers who wish to compete against other players in organized, skill-based competitions with entry fees and prizes.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground border-b pb-2">2. Nature of Competition</h2>
            <p className="text-muted-foreground mt-4">
              <strong>Skill-Based Activity:</strong> Golf competitions facilitated through MatchPlay are skill-based sporting events where the outcome is determined predominantly by the relative skill, knowledge, and physical ability of the participants, not by chance.
            </p>
            <p className="text-muted-foreground">
              <strong>Entry Fees and Prizes:</strong> Participants may pay entry fees to join competitions. These entry fees form a prize pool that is distributed to top-performing players based on their final scores. Entry fees are held in secure escrow until competition completion.
            </p>
            <p className="text-muted-foreground">
              <strong>Handicap System:</strong> Our handicap system is designed to create fair competition between players of different skill levels. Handicaps are calculated based on verified scores from completed rounds.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground border-b pb-2">3. Eligibility</h2>
            <p className="text-muted-foreground mt-4">
              To use MatchPlay, you must:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2">
              <li>Be at least 18 years of age (or the legal age of majority in your jurisdiction)</li>
              <li>Be located in a jurisdiction where participation in skill-based golf competitions with entry fees is permitted</li>
              <li>Create an account with accurate and complete information</li>
              <li>Maintain a valid payment method for entry fees and receiving prizes</li>
              <li>Agree to abide by the Rules of Golf as established by the USGA/R&A</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground border-b pb-2">4. User Responsibilities</h2>
            <p className="text-muted-foreground mt-4">
              As a MatchPlay user, you agree to:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2">
              <li>Record scores accurately and honestly during all rounds</li>
              <li>Complete matches you have committed to join</li>
              <li>Treat other players with respect and sportsmanship</li>
              <li>Not manipulate your handicap or scores</li>
              <li>Report any suspected violations of these terms</li>
              <li>Comply with all applicable golf course rules and etiquette</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground border-b pb-2">5. Entry Fees and Prizes</h2>
            <p className="text-muted-foreground mt-4">
              <strong>Entry Fee Processing:</strong> Entry fees are processed securely through our payment provider. All funds are held in escrow until competition completion.
            </p>
            <p className="text-muted-foreground">
              <strong>Prize Distribution:</strong> Prizes are distributed automatically upon match finalization based on final net scores. Distribution follows the prize structure specified for each competition format.
            </p>
            <p className="text-muted-foreground">
              <strong>Cancellation Policy:</strong> If a match is cancelled, entry fees are refunded minus a small administrative fee. Specific refund amounts depend on cancellation timing and circumstances.
            </p>
            <p className="text-muted-foreground">
              <strong>Disputes:</strong> In the event of a scoring dispute, matches may be flagged for administrative review. Our team will investigate and make final determinations on prize distribution.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground border-b pb-2">6. Account Balances and Withdrawals</h2>
            <p className="text-muted-foreground mt-4">
              Prize earnings are credited to your MatchPlay account balance. You may withdraw available funds to your linked payment method at any time, subject to our verification procedures and minimum withdrawal amounts.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground border-b pb-2">7. Fair Play Policy</h2>
            <p className="text-muted-foreground mt-4">
              MatchPlay maintains a zero-tolerance policy for:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2">
              <li>Score manipulation or falsification</li>
              <li>Handicap manipulation ("sandbagging")</li>
              <li>Collusion between players</li>
              <li>Use of prohibited equipment or devices</li>
              <li>Any form of cheating or unsportsmanlike conduct</li>
            </ul>
            <p className="text-muted-foreground mt-4">
              Violations may result in account suspension, forfeiture of prizes, and permanent ban from the Platform.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground border-b pb-2">8. Limitation of Liability</h2>
            <p className="text-muted-foreground mt-4">
              MatchPlay is a platform that facilitates competition organization and prize distribution. We are not responsible for:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2">
              <li>Golf course conditions or availability</li>
              <li>Weather-related cancellations or delays</li>
              <li>Injuries sustained during play</li>
              <li>Player disputes that occur outside the Platform</li>
              <li>Tax obligations arising from prize earnings</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground border-b pb-2">9. Privacy and Data</h2>
            <p className="text-muted-foreground mt-4">
              Your privacy is important to us. We collect and process personal information in accordance with our Privacy Policy. By using MatchPlay, you consent to our collection and use of your information as described therein.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground border-b pb-2">10. Changes to Terms</h2>
            <p className="text-muted-foreground mt-4">
              We may update these Terms from time to time. We will notify you of any material changes via email or through the Platform. Continued use of MatchPlay after such changes constitutes acceptance of the updated Terms.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground border-b pb-2">11. Contact Us</h2>
            <p className="text-muted-foreground mt-4">
              If you have questions about these Terms, please contact us at:
            </p>
            <p className="text-muted-foreground">
              Email: <a href="mailto:support@match-play.co" className="text-primary hover:underline">support@match-play.co</a>
            </p>
          </section>
        </div>

        {/* Back to Home */}
        <div className="mt-12 text-center">
          <Button asChild>
            <Link to="/">Return to MatchPlay</Link>
          </Button>
        </div>
      </main>
    </div>
  );
};

export default Terms;
