import { Crown, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useSubscription, SUBSCRIPTION_TIERS } from '@/hooks/useSubscription';
import { Skeleton } from '@/components/ui/skeleton';

interface SubscriptionCardProps {
  onManage: () => void;
}

const TIER_META: Record<
  string,
  {
    tagline: string;
    perks: string[];
    isPaid: boolean;
    bgClass: string;
    fgClass: string;
    mutedFgClass: string;
    iconBgClass: string;
    bulletClass: string;
  }
> = {
  Free: {
    tagline: 'Casual play, no commitment.',
    perks: ['Match Play & Stroke Play', 'Play money wallet', 'Standard handicap tracking'],
    isPaid: false,
    bgClass: 'bg-muted',
    fgClass: 'text-foreground',
    mutedFgClass: 'text-muted-foreground',
    iconBgClass: 'bg-background/60 text-foreground',
    bulletClass: 'bg-foreground/40',
  },
  'Local Player': {
    tagline: 'For regulars at your home course.',
    perks: ['Priority match listings', 'Advanced course stats', 'No platform fees on entry'],
    isPaid: true,
    bgClass: 'bg-gradient-primary',
    fgClass: 'text-primary-foreground',
    mutedFgClass: 'text-primary-foreground/80',
    iconBgClass: 'bg-primary-foreground/15 text-primary-foreground',
    bulletClass: 'bg-primary-foreground/70',
  },
  'Tournament Pro': {
    tagline: 'Compete at the highest level.',
    perks: ['Tournament hosting', 'Pro analytics suite', 'Verified handicap badge'],
    isPaid: true,
    bgClass: 'bg-gradient-accent',
    fgClass: 'text-accent-foreground',
    mutedFgClass: 'text-accent-foreground/80',
    iconBgClass: 'bg-accent-foreground/15 text-accent-foreground',
    bulletClass: 'bg-accent-foreground/70',
  },
};

export function SubscriptionCard({ onManage }: SubscriptionCardProps) {
  const { tierName, loading, subscriptionEnd, productId } = useSubscription();

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-4 w-64" />
        <Skeleton className="h-9 w-36" />
      </div>
    );
  }

  const currentTier = tierName ?? 'Free';
  const meta = TIER_META[currentTier] ?? TIER_META.Free;

  // Find pricing if user has a paid subscription
  const tierEntry = productId
    ? Object.values(SUBSCRIPTION_TIERS).find((t) => t.product_id === productId)
    : null;

  const renewLabel = subscriptionEnd
    ? `Renews ${new Date(subscriptionEnd).toLocaleDateString()}`
    : null;

  return (
    <div className={`rounded-xl border-2 ${meta.borderClass} ${meta.ringClass} bg-card p-4 sm:p-5 space-y-4 transition-colors`}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={`p-2 rounded-lg shrink-0 ${
              meta.isPaid
                ? 'bg-gradient-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground'
            }`}
          >
            {meta.isPaid ? (
              <Crown className="w-5 h-5" aria-hidden="true" />
            ) : (
              <Sparkles className="w-5 h-5" aria-hidden="true" />
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-semibold leading-none">{currentTier}</h3>
              <Badge variant={meta.isPaid ? 'default' : 'secondary'} className="text-[10px]">
                {meta.isPaid ? 'Active' : 'Current plan'}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">{meta.tagline}</p>
          </div>
        </div>

        {tierEntry && (
          <div className="text-right shrink-0">
            <p className="text-sm font-semibold">
              ${tierEntry.price}
              <span className="text-xs text-muted-foreground font-normal">/{tierEntry.interval}</span>
            </p>
            {renewLabel && (
              <p className="text-[11px] text-muted-foreground mt-0.5">{renewLabel}</p>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <ul className="text-xs text-muted-foreground space-y-1.5 flex-1">
          {meta.perks.map((perk) => (
            <li key={perk} className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-success shrink-0" aria-hidden="true" />
              {perk}
            </li>
          ))}
        </ul>

        <Button
          onClick={onManage}
          size="sm"
          className="w-full sm:w-auto sm:ml-auto bg-gradient-accent text-accent-foreground hover:shadow-premium transition-all duration-300"
        >
          {meta.isPaid ? 'Manage subscription' : 'Upgrade plan'}
        </Button>
      </div>
    </div>
  );
}
