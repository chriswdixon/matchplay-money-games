import { useState } from 'react';
import { Crown, Sparkles, Loader2, CalendarClock, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useSubscription, SUBSCRIPTION_TIERS } from '@/hooks/useSubscription';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface SubscriptionCardProps {
  onManage: () => void;
}

const TIER_META: Record<
  string,
  {
    tagline: string;
    perks: string[];
    isPaid: boolean;
  }
> = {
  Free: {
    tagline: 'Casual play, no commitment.',
    perks: ['Match Play & Stroke Play', 'Play money wallet', 'Standard handicap tracking'],
    isPaid: false,
  },
  'Local Player': {
    tagline: 'For regulars at your home course.',
    perks: ['Priority match listings', 'Advanced course stats', 'No platform fees on entry'],
    isPaid: true,
  },
  'Tournament Pro': {
    tagline: 'Compete at the highest level.',
    perks: ['Tournament hosting', 'Pro analytics suite', 'Verified handicap badge'],
    isPaid: true,
  },
};

type ConfirmAction = null | 'change' | 'cancel';

export function SubscriptionCard({ onManage }: SubscriptionCardProps) {
  const {
    tierName,
    loading,
    subscriptionEnd,
    productId,
    refreshSubscription,
    status,
    cancelAtPeriodEnd,
    latestInvoiceStatus,
    latestInvoiceAmountDue,
    latestInvoiceHostedUrl,
  } = useSubscription();
  const { session } = useAuth();
  const [manageOpen, setManageOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [busy, setBusy] = useState(false);

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

  const tierEntry = productId
    ? Object.values(SUBSCRIPTION_TIERS).find((t) => t.product_id === productId)
    : null;

  const dateFormatter = new Intl.DateTimeFormat(undefined, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
  const endDate = subscriptionEnd ? new Date(subscriptionEnd) : null;
  const renewLabel = endDate ? `Renews ${dateFormatter.format(endDate)}` : null;
  const cancelEffectiveLabel = endDate ? dateFormatter.format(endDate) : 'the end of your billing period';

  // Determine payment status presentation
  type PaymentTone = 'success' | 'warning' | 'danger' | 'muted';
  let paymentLabel: string | null = null;
  let paymentDetail: string | null = null;
  let paymentTone: PaymentTone = 'muted';
  let nextBillingLabel: string | null = null;

  if (meta.isPaid && endDate) {
    if (cancelAtPeriodEnd) {
      paymentLabel = 'Canceling';
      paymentDetail = `Access ends ${dateFormatter.format(endDate)}`;
      paymentTone = 'warning';
      nextBillingLabel = `Ends ${dateFormatter.format(endDate)}`;
    } else if (status === 'past_due' || status === 'unpaid') {
      paymentLabel = 'Payment failed';
      paymentDetail =
        latestInvoiceAmountDue && latestInvoiceAmountDue > 0
          ? `$${(latestInvoiceAmountDue / 100).toFixed(2)} due — update your payment method`
          : 'Update your payment method to keep access';
      paymentTone = 'danger';
      nextBillingLabel = `Retry by ${dateFormatter.format(endDate)}`;
    } else if (status === 'trialing') {
      paymentLabel = 'Trial';
      paymentDetail = `First charge on ${dateFormatter.format(endDate)}`;
      paymentTone = 'success';
      nextBillingLabel = `Next charge ${dateFormatter.format(endDate)}`;
    } else if (status === 'incomplete') {
      paymentLabel = 'Action required';
      paymentDetail = 'Finish payment confirmation to activate';
      paymentTone = 'warning';
      nextBillingLabel = null;
    } else {
      paymentLabel = latestInvoiceStatus === 'paid' ? 'Paid' : 'Active';
      paymentDetail = `Last payment ${latestInvoiceStatus ?? 'on file'}`;
      paymentTone = 'success';
      nextBillingLabel = `Next charge ${dateFormatter.format(endDate)}`;
    }
  }

  const toneStyles: Record<PaymentTone, { wrap: string; icon: React.ReactNode }> = {
    success: {
      wrap: 'bg-success/10 text-success border-success/20',
      icon: <CheckCircle2 className="w-4 h-4" aria-hidden="true" />,
    },
    warning: {
      wrap: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
      icon: <AlertTriangle className="w-4 h-4" aria-hidden="true" />,
    },
    danger: {
      wrap: 'bg-destructive/10 text-destructive border-destructive/20',
      icon: <XCircle className="w-4 h-4" aria-hidden="true" />,
    },
    muted: {
      wrap: 'bg-muted text-muted-foreground border-border',
      icon: <CheckCircle2 className="w-4 h-4" aria-hidden="true" />,
    },
  };

  const openPortal = async (intent: 'change' | 'cancel') => {
    if (!session?.access_token) {
      toast.error('Please sign in again to manage your subscription.');
      return;
    }
    try {
      setBusy(true);
      const { data, error } = await supabase.functions.invoke('customer-portal', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (error) throw error;
      if (!data?.url) throw new Error('No portal URL returned');
      // Open Stripe portal in a new tab so user keeps app context
      window.open(data.url, '_blank', 'noopener,noreferrer');
      toast.success(
        intent === 'cancel'
          ? 'Complete your cancellation in the secure billing portal.'
          : 'Choose your new plan in the secure billing portal.',
      );
      setConfirmAction(null);
      setManageOpen(false);
      // Refresh after a short delay so UI catches changes when they return
      setTimeout(() => refreshSubscription(), 5000);
    } catch (err) {
      console.error('Portal error', err);
      toast.error('Could not open the billing portal. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const handlePrimary = () => {
    if (meta.isPaid) {
      setManageOpen(true);
    } else {
      onManage();
    }
  };

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

      {meta.isPaid && (paymentLabel || nextBillingLabel) && (
        <div className="grid sm:grid-cols-2 gap-2">
          {nextBillingLabel && (
            <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2">
              <CalendarClock className="w-4 h-4 mt-0.5 text-muted-foreground" aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  {cancelAtPeriodEnd ? 'Access ends' : 'Next billing date'}
                </p>
                <p className="text-sm font-medium text-foreground truncate">
                  {endDate ? dateFormatter.format(endDate) : '—'}
                </p>
              </div>
            </div>
          )}
          {paymentLabel && (
            <div
              className={`flex items-start gap-2 rounded-lg border px-3 py-2 ${toneStyles[paymentTone].wrap}`}
            >
              <span className="mt-0.5">{toneStyles[paymentTone].icon}</span>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] uppercase tracking-wide opacity-80">Payment status</p>
                <p className="text-sm font-medium truncate">{paymentLabel}</p>
                {paymentDetail && <p className="text-xs opacity-90 truncate">{paymentDetail}</p>}
                {paymentTone === 'danger' && latestInvoiceHostedUrl && (
                  <a
                    href={latestInvoiceHostedUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs underline font-medium"
                  >
                    Pay invoice
                  </a>
                )}
              </div>
            </div>
          )}
        </div>
      )}

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
          onClick={handlePrimary}
          size="sm"
          className="w-full sm:w-auto sm:ml-auto bg-gradient-accent text-accent-foreground hover:shadow-premium transition-all duration-300"
        >
          {meta.isPaid ? 'Manage subscription' : 'Upgrade plan'}
        </Button>
      </div>

      {/* Step 1: Manage dialog — choose change vs cancel */}
      <Dialog open={manageOpen} onOpenChange={setManageOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Manage subscription</DialogTitle>
            <DialogDescription>
              You're currently on the <strong>{currentTier}</strong> plan
              {tierEntry ? ` ($${tierEntry.price}/${tierEntry.interval})` : ''}.
              {renewLabel ? ` ${renewLabel}.` : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 py-2">
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => setConfirmAction('change')}
              disabled={busy}
            >
              Change plan
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start text-destructive hover:text-destructive"
              onClick={() => setConfirmAction('cancel')}
              disabled={busy}
            >
              Cancel subscription
            </Button>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setManageOpen(false)} disabled={busy}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Step 2: Confirmation */}
      <AlertDialog
        open={confirmAction !== null}
        onOpenChange={(open) => !open && !busy && setConfirmAction(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction === 'cancel' ? 'Cancel your subscription?' : 'Change your plan?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction === 'cancel' ? (
                <>
                  You'll keep <strong>{currentTier}</strong> access until{' '}
                  <strong>{cancelEffectiveLabel}</strong>, then drop to the Free plan. We'll open
                  the secure billing portal to finalize the cancellation.
                </>
              ) : (
                <>
                  We'll open the secure billing portal where you can switch to a different plan or
                  billing interval. Changes take effect immediately with prorated billing.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Go back</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (confirmAction) openPortal(confirmAction);
              }}
              disabled={busy}
              className={
                confirmAction === 'cancel'
                  ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                  : ''
              }
            >
              {busy ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" />
                  Opening…
                </>
              ) : confirmAction === 'cancel' ? (
                'Continue to cancel'
              ) : (
                'Continue to change plan'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
