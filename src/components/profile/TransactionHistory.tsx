import { useMemo, useState, Suspense, lazy } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAccountTransactions } from '@/hooks/useAccountTransactions';
import { useIsMobile } from '@/hooks/use-mobile';
import { History, TrendingDown, CreditCard, Trophy, Ticket, LogOut, Zap, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { format } from 'date-fns';

const MatchInfoDialog = lazy(() =>
  import('@/components/MatchInfoDialog').then((m) => ({ default: m.MatchInfoDialog })),
);

const TransactionHistoryHeader = () => (
  <h2 className="flex items-center gap-3 text-lg font-semibold leading-none tracking-tight">
    <div className="p-2 bg-gradient-primary rounded-lg">
      <History className="w-5 h-5 text-primary-foreground" />
    </div>
    Transaction History
  </h2>
);

export function TransactionHistory() {
  const { transactions, loading } = useAccountTransactions();
  const isMobile = useIsMobile();
  const [page, setPage] = useState(0);
  const [infoMatchId, setInfoMatchId] = useState<string | null>(null);
  const PAGE_SIZE = 3;

  const totalPages = isMobile
    ? Math.max(1, Math.ceil(transactions.length / PAGE_SIZE))
    : 1;
  const safePage = Math.min(page, totalPages - 1);
  const visibleTransactions = useMemo(
    () =>
      isMobile
        ? transactions.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE)
        : transactions,
    [transactions, isMobile, safePage],
  );

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'winning': return <Trophy className="w-4 h-4" />;
      case 'match_buyin': return <CreditCard className="w-4 h-4" />;
      case 'payout': return <TrendingDown className="w-4 h-4" />;
      case 'match_cancellation': return <LogOut className="w-4 h-4" />;
      case 'coupon': return <Ticket className="w-4 h-4" />;
      case 'double_down': return <Zap className="w-4 h-4" />;
      case 'subscription_charge': return <CreditCard className="w-4 h-4" />;
      default: return <History className="w-4 h-4" />;
    }
  };

  const getTransactionColor = (_type: string, amount: number) => {
    if (amount > 0) return 'text-success';
    if (amount < 0) return 'text-destructive';
    return 'text-muted-foreground';
  };

  const getTransactionLabel = (type: string) => {
    switch (type) {
      case 'winning': return 'Match Winnings';
      case 'match_buyin': return 'Match Buy-in';
      case 'payout': return 'Payout';
      case 'match_cancellation': return 'Left Match / Cancellation';
      case 'subscription_charge': return 'Subscription Fee';
      case 'coupon': return 'Coupon Credit';
      case 'double_down': return 'Double Down';
      default: return type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }
  };

  if (loading) {
    return (
      <div className="space-y-4" aria-busy="true" aria-live="polite">
        <TransactionHistoryHeader />
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
            >
              <div className="flex items-center gap-3 flex-1">
                <Skeleton className="w-9 h-9 rounded-lg" />
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-3 w-32" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </div>
              <Skeleton className="h-4 w-14" />
            </div>
          ))}
        </div>
        <span className="sr-only">Loading transactions…</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <TransactionHistoryHeader />
      <div>
        {transactions.length === 0 ? (
          <div className="text-center py-10 px-4 rounded-xl border border-dashed bg-muted/30">
            <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
              <History className="w-6 h-6 text-primary" aria-hidden="true" />
            </div>
            <p className="font-semibold text-sm">No transactions yet</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
              Join or create a match to start tracking your entry fees, prizes, and refunds here.
            </p>
            <div className="flex flex-wrap justify-center gap-2 mt-4">
              <Button asChild size="sm" className="rounded-full">
                <Link to="/?tab=matches">
                  <Search className="w-4 h-4 mr-1.5" aria-hidden="true" />
                  Find a match
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm" className="rounded-full">
                <Link to="/create-match">Create a match</Link>
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {visibleTransactions.map((transaction) => {
              const amountInCents = parseFloat(transaction.amount.toString());
              const amountInDollars = amountInCents / 100;
              const isPositive = amountInCents > 0;

              const hasMatch = !!transaction.match_id;
              const handleOpen = () => hasMatch && setInfoMatchId(transaction.match_id!);
              return (
                <div
                  key={transaction.id}
                  className={`flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors ${hasMatch ? 'cursor-pointer' : ''}`}
                  onClick={hasMatch ? handleOpen : undefined}
                  role={hasMatch ? 'button' : undefined}
                  tabIndex={hasMatch ? 0 : undefined}
                  onKeyDown={
                    hasMatch
                      ? (e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            handleOpen();
                          }
                        }
                      : undefined
                  }
                  aria-label={hasMatch ? 'View match details' : undefined}
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${isPositive ? 'bg-success/10' : 'bg-destructive/10'}`}>
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

            {isMobile && transactions.length > PAGE_SIZE && (
              <div className="flex items-center justify-center gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={safePage === 0}
                  aria-label="Previous page"
                  className="h-8 w-8"
                >
                  <ChevronLeft className="w-4 h-4" aria-hidden="true" />
                </Button>
                <div className="flex items-center gap-1.5" aria-hidden="true">
                  {Array.from({ length: totalPages }).map((_, i) => (
                    <span
                      key={i}
                      className={
                        i === safePage
                          ? 'w-2 h-2 rounded-full bg-primary'
                          : 'w-2 h-2 rounded-full bg-muted-foreground/30'
                      }
                    />
                  ))}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={safePage >= totalPages - 1}
                  aria-label="Next page"
                  className="h-8 w-8"
                >
                  <ChevronRight className="w-4 h-4" aria-hidden="true" />
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
      <Suspense fallback={null}>
        <MatchInfoDialog
          matchId={infoMatchId}
          open={!!infoMatchId}
          onOpenChange={(o) => !o && setInfoMatchId(null)}
        />
      </Suspense>
    </div>
  );
}
