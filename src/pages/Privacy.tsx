import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Shield, Database, Eye, Lock, Globe, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";

const Privacy = () => {
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
          <h1 className="text-4xl font-bold mb-4 text-foreground">Privacy Policy</h1>
          <p className="text-lg text-muted-foreground">
            Last updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </p>
        </div>

        {/* Key Points Cards */}
        <div className="grid md:grid-cols-3 gap-4 mb-12">
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Shield className="w-5 h-5 text-primary" />
                Your Rights
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Access, correct, delete, or export your personal data at any time.
              </p>
            </CardContent>
          </Card>

          <Card className="border-primary/20 bg-primary/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Lock className="w-5 h-5 text-primary" />
                Data Security
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Bank-level encryption protects all personal and financial information.
              </p>
            </CardContent>
          </Card>

          <Card className="border-primary/20 bg-primary/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Eye className="w-5 h-5 text-primary" />
                Transparency
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Clear disclosure of what data we collect and why.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Privacy Content */}
        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-8">
          <section>
            <h2 className="text-2xl font-semibold text-foreground border-b pb-2">1. Introduction</h2>
            <p className="text-muted-foreground mt-4">
              MatchPlay ("we," "us," or "our") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our competitive golf platform.
            </p>
            <p className="text-muted-foreground">
              By using MatchPlay, you agree to the collection and use of information in accordance with this policy. We comply with applicable data protection laws including the General Data Protection Regulation (GDPR) and the California Consumer Privacy Act (CCPA).
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground border-b pb-2 flex items-center gap-2">
              <Database className="w-6 h-6" />
              2. Information We Collect
            </h2>
            
            <h3 className="text-xl font-medium text-foreground mt-6">2.1 Information You Provide</h3>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2">
              <li><strong>Account Information:</strong> Name, email address, phone number, date of birth (to verify age eligibility)</li>
              <li><strong>Profile Information:</strong> Display name, profile picture, golf handicap</li>
              <li><strong>Payment Information:</strong> Payment method details processed securely through Stripe (we do not store full card numbers)</li>
              <li><strong>Competition Data:</strong> Match scores, handicap history, competition results</li>
              <li><strong>Communications:</strong> Messages, feedback, and support requests</li>
            </ul>

            <h3 className="text-xl font-medium text-foreground mt-6">2.2 Information Collected Automatically</h3>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2">
              <li><strong>Device Information:</strong> Device type, operating system, browser type</li>
              <li><strong>Location Data:</strong> GPS coordinates when using course-finding features (with your permission)</li>
              <li><strong>Usage Data:</strong> Pages visited, features used, time spent on platform</li>
              <li><strong>Log Data:</strong> IP address, access times, error logs</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground border-b pb-2">3. How We Use Your Information</h2>
            <p className="text-muted-foreground mt-4">We use collected information to:</p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2">
              <li>Provide and maintain our competitive golf platform</li>
              <li>Process entry fees and distribute prizes</li>
              <li>Calculate and track handicaps based on verified scores</li>
              <li>Match players with compatible competitors</li>
              <li>Prevent fraud and ensure fair play</li>
              <li>Send service-related communications</li>
              <li>Improve our platform and develop new features</li>
              <li>Comply with legal obligations</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground border-b pb-2">4. Legal Basis for Processing (GDPR)</h2>
            <p className="text-muted-foreground mt-4">Under GDPR, we process your data based on:</p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2">
              <li><strong>Contract Performance:</strong> Processing necessary to provide our services</li>
              <li><strong>Legitimate Interests:</strong> Fraud prevention, platform security, service improvement</li>
              <li><strong>Legal Compliance:</strong> Meeting regulatory requirements</li>
              <li><strong>Consent:</strong> For marketing communications and optional features</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground border-b pb-2">5. Data Sharing and Disclosure</h2>
            <p className="text-muted-foreground mt-4">We may share your information with:</p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2">
              <li><strong>Other Players:</strong> Limited profile information (display name, handicap) visible to match participants</li>
              <li><strong>Payment Processors:</strong> Stripe processes all payments securely</li>
              <li><strong>Service Providers:</strong> Hosting, analytics, and communication services bound by confidentiality agreements</li>
              <li><strong>Legal Authorities:</strong> When required by law or to protect rights and safety</li>
            </ul>
            <p className="text-muted-foreground mt-4">
              <strong>We do not sell your personal information to third parties.</strong>
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground border-b pb-2">6. Data Retention</h2>
            <p className="text-muted-foreground mt-4">We retain your data for as long as:</p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2">
              <li>Your account remains active</li>
              <li>Necessary to provide services</li>
              <li>Required for legal, accounting, or reporting obligations</li>
              <li>Needed to resolve disputes or enforce agreements</li>
            </ul>
            <p className="text-muted-foreground mt-4">
              Competition records and handicap history may be retained for platform integrity even after account deletion, but will be anonymized.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground border-b pb-2 flex items-center gap-2">
              <Globe className="w-6 h-6" />
              7. Your Rights (GDPR & CCPA)
            </h2>
            
            <h3 className="text-xl font-medium text-foreground mt-6">7.1 GDPR Rights (EU/EEA Residents)</h3>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2">
              <li><strong>Right of Access:</strong> Request copies of your personal data</li>
              <li><strong>Right to Rectification:</strong> Request correction of inaccurate data</li>
              <li><strong>Right to Erasure:</strong> Request deletion of your data ("right to be forgotten")</li>
              <li><strong>Right to Restrict Processing:</strong> Request limitation of data processing</li>
              <li><strong>Right to Data Portability:</strong> Receive your data in a portable format</li>
              <li><strong>Right to Object:</strong> Object to processing based on legitimate interests</li>
              <li><strong>Right to Withdraw Consent:</strong> Withdraw consent at any time</li>
            </ul>

            <h3 className="text-xl font-medium text-foreground mt-6">7.2 CCPA Rights (California Residents)</h3>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2">
              <li><strong>Right to Know:</strong> What personal information is collected and how it's used</li>
              <li><strong>Right to Delete:</strong> Request deletion of personal information</li>
              <li><strong>Right to Opt-Out:</strong> Opt-out of sale of personal information (we do not sell data)</li>
              <li><strong>Right to Non-Discrimination:</strong> Equal service regardless of exercising privacy rights</li>
            </ul>

            <p className="text-muted-foreground mt-4">
              To exercise any of these rights, contact us at <a href="mailto:privacy@match-play.co" className="text-primary hover:underline">privacy@match-play.co</a>.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground border-b pb-2 flex items-center gap-2">
              <Lock className="w-6 h-6" />
              8. Data Security
            </h2>
            <p className="text-muted-foreground mt-4">We implement industry-standard security measures:</p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2">
              <li>TLS/SSL encryption for all data transmission</li>
              <li>Encrypted storage for sensitive data at rest</li>
              <li>Regular security audits and vulnerability assessments</li>
              <li>Access controls and authentication requirements</li>
              <li>Row-level security (RLS) policies in our database</li>
              <li>Secure payment processing through PCI-compliant Stripe</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground border-b pb-2">9. International Data Transfers</h2>
            <p className="text-muted-foreground mt-4">
              Your data may be transferred to and processed in countries outside your residence. We ensure appropriate safeguards are in place, including:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2">
              <li>Standard Contractual Clauses (SCCs) for EU data transfers</li>
              <li>Data Processing Agreements with service providers</li>
              <li>Compliance with applicable international transfer mechanisms</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground border-b pb-2">10. Cookies and Tracking</h2>
            <p className="text-muted-foreground mt-4">We use essential cookies for:</p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2">
              <li>Authentication and session management</li>
              <li>Security and fraud prevention</li>
              <li>Remembering user preferences</li>
            </ul>
            <p className="text-muted-foreground mt-4">
              You can manage cookie preferences through your browser settings.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground border-b pb-2">11. Children's Privacy</h2>
            <p className="text-muted-foreground mt-4">
              MatchPlay is not intended for users under 18 years of age. We do not knowingly collect personal information from children. If we learn we have collected data from a minor, we will delete it promptly.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground border-b pb-2">12. Changes to This Policy</h2>
            <p className="text-muted-foreground mt-4">
              We may update this Privacy Policy periodically. We will notify you of material changes via email or prominent notice on our platform. Continued use after changes constitutes acceptance.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground border-b pb-2 flex items-center gap-2">
              <Trash2 className="w-6 h-6" />
              13. Account Deletion
            </h2>
            <p className="text-muted-foreground mt-4">
              You may request account deletion at any time through your profile settings or by contacting support. Upon deletion:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2">
              <li>Your profile and personal information will be removed</li>
              <li>Historical match data will be anonymized but retained for platform integrity</li>
              <li>Any outstanding balance will be processed according to our withdrawal policy</li>
              <li>Deletion requests are processed within 30 days</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground border-b pb-2">14. Contact Us</h2>
            <p className="text-muted-foreground mt-4">
              For privacy-related inquiries or to exercise your rights:
            </p>
            <div className="text-muted-foreground mt-4 space-y-2">
              <p><strong>Email:</strong> <a href="mailto:privacy@match-play.co" className="text-primary hover:underline">privacy@match-play.co</a></p>
              <p><strong>General Support:</strong> <a href="mailto:support@match-play.co" className="text-primary hover:underline">support@match-play.co</a></p>
            </div>
            <p className="text-muted-foreground mt-4">
              EU residents may also lodge a complaint with your local Data Protection Authority.
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

export default Privacy;
