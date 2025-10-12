import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { CreditCard, Plus } from 'lucide-react';
import { PaymentMethodSetup } from '@/components/auth/PaymentMethodSetup';

export function PaymentMethods() {
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <Card className="shadow-card">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-3">
          <div className="p-2 bg-gradient-primary rounded-lg">
            <CreditCard className="w-5 h-5 text-primary-foreground" />
          </div>
          Payment Methods
        </CardTitle>
        <CardDescription>
          Manage your credit cards and bank accounts
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Add a payment method to participate in matches with buy-ins and receive payouts from your winnings.
          </p>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="w-full bg-gradient-primary gap-2">
                <Plus className="w-4 h-4" />
                Add Payment Method
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Add Payment Method</DialogTitle>
                <DialogDescription>
                  Add a credit card or bank account for transactions
                </DialogDescription>
              </DialogHeader>
              <PaymentMethodSetup 
                onComplete={() => setDialogOpen(false)}
              />
            </DialogContent>
          </Dialog>
        </div>
      </CardContent>
    </Card>
  );
}
