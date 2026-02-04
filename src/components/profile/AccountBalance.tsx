import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { usePlayerAccount } from '@/hooks/usePlayerAccount';
import { DollarSign, TrendingUp, Info } from 'lucide-react';

export function AccountBalance() {
  const { account, loading } = usePlayerAccount();

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-muted rounded w-32"></div>
            <div className="h-12 bg-muted rounded w-full"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const balance = account ? parseFloat(account.balance.toString()) / 100 : 0;

  return (
    <Card className="shadow-card">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-3">
          <div className="p-2 bg-gradient-primary rounded-lg">
            <DollarSign className="w-5 h-5 text-primary-foreground" />
          </div>
          Play Money Balance
        </CardTitle>
        <CardDescription>
          Your play money for matches
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Balance Display */}
        <div className="bg-gradient-subtle rounded-lg p-6 border border-border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Available Balance</p>
              <p className="text-4xl font-bold text-foreground">
                ${balance.toFixed(2)}
              </p>
            </div>
            <div className="p-3 bg-gradient-primary/10 rounded-full">
              <TrendingUp className="w-8 h-8 text-primary" />
            </div>
          </div>
        </div>

        {/* Info */}
        <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-lg">
          <Info className="w-5 h-5 text-primary mt-0.5 shrink-0" />
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">
              This is <strong>play money</strong> for participating in matches. Win matches to earn more!
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
