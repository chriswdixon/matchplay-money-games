import { usePlayerAccount } from '@/hooks/usePlayerAccount';
import { DollarSign, TrendingUp, Info } from 'lucide-react';

export function AccountBalance() {
  const { account, loading } = usePlayerAccount();

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-muted rounded w-32"></div>
        <div className="h-12 bg-muted rounded w-full"></div>
      </div>
    );
  }

  const balance = account ? parseFloat(account.balance.toString()) / 100 : 0;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="flex items-center gap-3 text-lg font-semibold leading-none tracking-tight">
          <div className="p-2 bg-gradient-primary rounded-lg">
            <DollarSign className="w-5 h-5 text-primary-foreground" />
          </div>
          Play Money Balance
        </h2>
      </div>

      {/* Balance Display */}
      <div className="bg-gradient-subtle rounded-lg p-6 border border-border">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Available Balance</p>
            <p className="text-4xl font-bold text-foreground">
              ${balance.toFixed(2)}
            </p>
            <p className="text-xs text-muted-foreground mt-2">Play money — not real currency</p>
          </div>
          <div className="p-3 bg-gradient-primary/10 rounded-full">
            <TrendingUp className="w-8 h-8 text-primary" />
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-lg">
        <Info className="w-5 h-5 text-primary mt-0.5 shrink-0" />
        <div className="space-y-1 text-sm text-muted-foreground">
          <p>
            Every new player starts with <strong className="text-foreground">$500</strong> in play money.
            Win matches to grow your balance — losses are deducted from entry fees.
          </p>
        </div>
      </div>
    </div>
  );
}
