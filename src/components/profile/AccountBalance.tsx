import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { usePlayerAccount } from '@/hooks/usePlayerAccount';
import { DollarSign, TrendingUp, ArrowUpRight, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export function AccountBalance() {
  const { account, loading, requestPayout } = usePlayerAccount();
  const [payoutAmount, setPayoutAmount] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const handlePayout = async () => {
    const amount = parseFloat(payoutAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    setIsProcessing(true);
    const { error } = await requestPayout(amount);
    setIsProcessing(false);

    if (!error) {
      setPayoutAmount('');
      setDialogOpen(false);
    }
  };

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

  const balance = account ? parseFloat(account.balance.toString()) : 0;

  return (
    <Card className="shadow-card">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-3">
          <div className="p-2 bg-gradient-primary rounded-lg">
            <DollarSign className="w-5 h-5 text-primary-foreground" />
          </div>
          Account Balance
        </CardTitle>
        <CardDescription>
          Your winnings and available funds
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

        {/* Payout Button */}
        {balance > 0 && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="w-full bg-gradient-primary text-primary-foreground hover:opacity-90 gap-2">
                <ArrowUpRight className="w-4 h-4" />
                Request Payout
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Request Payout</DialogTitle>
                <DialogDescription>
                  Transfer funds from your account to your payment method
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="amount">Payout Amount</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                    <Input
                      id="amount"
                      type="number"
                      step="0.01"
                      min="0"
                      max={balance}
                      value={payoutAmount}
                      onChange={(e) => setPayoutAmount(e.target.value)}
                      className="pl-7"
                      placeholder="0.00"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Maximum: ${balance.toFixed(2)}
                  </p>
                </div>
                <Button
                  onClick={handlePayout}
                  disabled={isProcessing || !payoutAmount}
                  className="w-full bg-gradient-primary"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    'Confirm Payout'
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}

        {balance === 0 && (
          <div className="text-center py-4 text-muted-foreground">
            <p className="text-sm">
              Win matches to build your balance and earn payouts!
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
