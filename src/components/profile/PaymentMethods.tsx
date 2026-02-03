import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Wallet, Info } from 'lucide-react';

export function PaymentMethods() {
  return (
    <Card className="shadow-card">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-3">
          <div className="p-2 bg-gradient-primary rounded-lg">
            <Wallet className="w-5 h-5 text-primary-foreground" />
          </div>
          Play Money
        </CardTitle>
        <CardDescription>
          Your account uses play money for matches
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-lg">
            <Info className="w-5 h-5 text-primary mt-0.5 shrink-0" />
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                All matches use <strong>play money</strong>. New accounts start with $500 to participate in matches.
              </p>
              <p className="text-sm text-muted-foreground">
                Win matches to earn more play money and climb the leaderboard!
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
