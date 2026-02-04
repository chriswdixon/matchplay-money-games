import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAccountTransactions } from '@/hooks/useAccountTransactions';
import { History, TrendingUp, TrendingDown, CreditCard, Trophy, XCircle, Ticket, Loader2, LogOut, Zap } from 'lucide-react';
import { format } from 'date-fns';

export function TransactionHistory() {
  const { transactions, loading } = useAccountTransactions();

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'winning':
        return <Trophy className="w-4 h-4" />;
      case 'match_buyin':
        return <CreditCard className="w-4 h-4" />;
      case 'payout':
        return <TrendingDown className="w-4 h-4" />;
      case 'match_cancellation':
        return <LogOut className="w-4 h-4" />;
      case 'coupon':
        return <Ticket className="w-4 h-4" />;
      case 'double_down':
        return <Zap className="w-4 h-4" />;
      case 'subscription_charge':
        return <CreditCard className="w-4 h-4" />;
      default:
        return <History className="w-4 h-4" />;
    }
  };

  const getTransactionColor = (type: string, amount: number) => {
    // Color based on whether money was gained or lost
    if (amount > 0) {
      return 'text-green-600 dark:text-green-400';
    } else if (amount < 0) {
      return 'text-red-600 dark:text-red-400';
    }
    return 'text-muted-foreground';
  };

  const getTransactionLabel = (type: string) => {
    switch (type) {
      case 'winning':
        return 'Match Winnings';
      case 'match_buyin':
        return 'Match Buy-in';
      case 'payout':
        return 'Payout';
      case 'match_cancellation':
        return 'Left Match / Cancellation';
      case 'subscription_charge':
        return 'Subscription Fee';
      case 'coupon':
        return 'Coupon Credit';
      case 'double_down':
        return 'Double Down';
      default:
        return type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-card">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-3">
          <div className="p-2 bg-gradient-primary rounded-lg">
            <History className="w-5 h-5 text-primary-foreground" />
          </div>
          Transaction History
        </CardTitle>
        <CardDescription>
          Your recent account activity
        </CardDescription>
      </CardHeader>
      <CardContent>
        {transactions.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <History className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No transactions yet</p>
            <p className="text-sm mt-1">Your transaction history will appear here</p>
          </div>
        ) : (
          <div className="space-y-3">
            {transactions.map((transaction) => {
              // Amount is stored in cents, convert to dollars for display
              const amountInCents = parseFloat(transaction.amount.toString());
              const amountInDollars = amountInCents / 100;
              const isPositive = amountInCents > 0;

              return (
                <div
                  key={transaction.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${isPositive ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
                      {getTransactionIcon(transaction.transaction_type)}
                    </div>
                    <div>
                      <p className="font-medium text-sm">
                        {getTransactionLabel(transaction.transaction_type)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(transaction.created_at), 'MMM d, yyyy h:mm a')}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-semibold ${getTransactionColor(transaction.transaction_type, amountInCents)}`}>
                      {isPositive ? '+' : '-'}${Math.abs(amountInDollars).toFixed(2)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
