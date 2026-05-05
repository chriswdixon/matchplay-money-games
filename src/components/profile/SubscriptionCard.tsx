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
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg shrink-0 bg-success text-success-foreground">
          {meta.isPaid ? (
            <Crown className="w-5 h-5" aria-hidden="true" />
          ) : (
            <Sparkles className="w-5 h-5" aria-hidden="true" />
          )}
        </div>
        <h2 className="text-xl font-semibold text-foreground">Subscription</h2>
      </div>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-base font-semibold leading-none text-foreground">{currentTier}</h3>
            <Badge variant="secondary" className="text-[10px]">
              {meta.isPaid ? 'Active' : 'Current plan'}
            </Badge>
          </div>
          <p className="text-xs mt-1 text-muted-foreground">{meta.tagline}</p>
        </div>

        {tierEntry && (
          <div className="text-right shrink-0">
            <p className="text-sm font-semibold text-foreground">
              ${tierEntry.price}
              <span className="text-xs font-normal text-muted-foreground">/{tierEntry.interval}</span>
            </p>
            {renewLabel && (
              <p className="text-[11px] mt-0.5 text-muted-foreground">{renewLabel}</p>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <ul className="text-xs space-y-1.5 flex-1 text-muted-foreground">
          {meta.perks.map((perk) => (
            <li key={perk} className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full shrink-0 bg-success" aria-hidden="true" />
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
