import { useEffect, useMemo, useState, Suspense, lazy } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useAccountTransactions, type AccountTransaction } from '@/hooks/useAccountTransactions';
import { useIsMobile } from '@/hooks/use-mobile';
import { History, TrendingDown, CreditCard, Trophy, Ticket, LogOut, Zap, ChevronLeft, ChevronRight, Search, X, ArrowUpDown } from 'lucide-react';
import { format } from 'date-fns';

const MatchInfoDialog = lazy(() =>
  import('@/components/MatchInfoDialog').then((m) => ({ default: m.MatchInfoDialog })),
);

const TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: 'all', label: 'All types' },
  { value: 'winning', label: 'Winnings' },
  { value: 'payout', label: 'Payouts' },
  { value: 'match_buyin', label: 'Buy-ins' },
  { value: 'match_cancellation', label: 'Cancellations' },
  { value: 'coupon', label: 'Coupons' },
  { value: 'double_down', label: 'Double Down' },
  { value: 'subscription_charge', label: 'Subscription' },
];

const DATE_OPTIONS: { value: string; label: string }[] = [
  { value: 'all', label: 'All time' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
  { value: '1y', label: 'Last year' },
];

const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'amount_desc', label: 'Largest amount' },
  { value: 'amount_asc', label: 'Smallest amount' },
];

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
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [directionFilter, setDirectionFilter] = useState<'all' | 'in' | 'out'>('all');
  const [dateFilter, setDateFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('newest');
  const PAGE_SIZE = isMobile ? 3 : 10;

  const filteredTransactions = useMemo(() => {
    let list: AccountTransaction[] = [...transactions];

    if (typeFilter !== 'all') {
      list = list.filter((t) => t.transaction_type === typeFilter);
    }

    if (directionFilter !== 'all') {
      list = list.filter((t) => {
        const amt = parseFloat(t.amount.toString());
        return directionFilter === 'in' ? amt > 0 : amt < 0;
      });
    }

    if (dateFilter !== 'all') {
      const days = dateFilter === '7d' ? 7 : dateFilter === '30d' ? 30 : dateFilter === '90d' ? 90 : 365;
      const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
      list = list.filter((t) => new Date(t.created_at).getTime() >= cutoff);
    }

    list.sort((a, b) => {
      const aAmt = Math.abs(parseFloat(a.amount.toString()));
      const bAmt = Math.abs(parseFloat(b.amount.toString()));
      const aTime = new Date(a.created_at).getTime();
      const bTime = new Date(b.created_at).getTime();
      switch (sortBy) {
        case 'oldest': return aTime - bTime;
        case 'amount_desc': return bAmt - aAmt;
        case 'amount_asc': return aAmt - bAmt;
        case 'newest':
        default: return bTime - aTime;
      }
    });

    return list;
  }, [transactions, typeFilter, directionFilter, dateFilter, sortBy]);

  useEffect(() => {
    setPage(0);
  }, [typeFilter, directionFilter, dateFilter, sortBy]);

  const hasActiveFilters = typeFilter !== 'all' || directionFilter !== 'all' || dateFilter !== 'all';
  const totalPages = Math.max(1, Math.ceil(filteredTransactions.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const visibleTransactions = useMemo(
    () => filteredTransactions.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE),
    [filteredTransactions, safePage, PAGE_SIZE],
  );

  const clearFilters = () => {
    setTypeFilter('all');
    setDirectionFilter('all');
    setDateFilter('all');
    setSortBy('newest');
  };

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

            {transactions.length > PAGE_SIZE && (
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
