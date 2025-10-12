import { useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CreditCard, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// Load Stripe with your publishable key
if (!import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY) {
  throw new Error('Stripe publishable key not configured. Please set VITE_STRIPE_PUBLISHABLE_KEY in your environment variables.');
}
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

interface PaymentMethodSetupProps {
  onComplete: () => void;
  onSkip?: () => void;
}

function PaymentMethodForm({ onComplete, onSkip }: PaymentMethodSetupProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      // Create payment method
      const { error: submitError, paymentMethod } = await stripe.createPaymentMethod({
        elements,
      });

      if (submitError) {
        throw new Error(submitError.message);
      }

      if (!paymentMethod) {
        throw new Error('Failed to create payment method');
      }

      // Attach payment method to customer via edge function
      const { data: { session } } = await supabase.auth.getSession();
      
      const { data, error: attachError } = await supabase.functions.invoke('setup-payment-method', {
        body: { paymentMethodId: paymentMethod.id },
        headers: {
          Authorization: `Bearer ${session?.access_token}`
        }
      });

      if (attachError) throw attachError;

      toast.success('Payment method added successfully!');
      onComplete();
    } catch (err: any) {
      console.error('Payment method setup error:', err);
      setError(err.message || 'Failed to add payment method');
      toast.error('Failed to add payment method');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <PaymentElement 
          options={{
            layout: 'tabs',
            paymentMethodOrder: ['card', 'us_bank_account']
          }}
        />
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col gap-3">
        <Button
          type="submit"
          disabled={!stripe || isProcessing}
          className="w-full bg-gradient-primary"
        >
          {isProcessing ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <CreditCard className="w-4 h-4 mr-2" />
              Add Payment Method
            </>
          )}
        </Button>

        {onSkip && (
          <Button
            type="button"
            variant="ghost"
            onClick={onSkip}
            disabled={isProcessing}
            className="w-full"
          >
            Skip for now
          </Button>
        )}
      </div>
    </form>
  );
}

export function PaymentMethodSetup({ onComplete, onSkip }: PaymentMethodSetupProps) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleGetStarted = async () => {
    setIsLoading(true);
    try {
      // Get setup intent from Stripe to collect payment method
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch('https://rgdegvpfnilzkqpexgij.supabase.co/functions/v1/create-setup-intent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        }
      });

      const { clientSecret: secret } = await response.json();
      setClientSecret(secret);
    } catch (error) {
      console.error('Error creating setup intent:', error);
      toast.error('Failed to initialize payment setup');
    } finally {
      setIsLoading(false);
    }
  };

  if (!clientSecret) {
    return (
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <div className="p-2 bg-gradient-primary rounded-lg">
              <CreditCard className="w-5 h-5 text-primary-foreground" />
            </div>
            Add Payment Method
          </CardTitle>
          <CardDescription>
            Add a credit card or bank account to participate in matches with buy-ins
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <p className="text-sm text-muted-foreground">
              Your payment method will be used for:
            </p>
            <ul className="text-sm space-y-1 list-disc list-inside text-muted-foreground">
              <li>Match buy-ins when your balance is insufficient</li>
              <li>Receiving payouts from your winnings</li>
              <li>Subscription payments</li>
            </ul>
          </div>

          <Button
            onClick={handleGetStarted}
            disabled={isLoading}
            className="w-full bg-gradient-primary"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Loading...
              </>
            ) : (
              'Get Started'
            )}
          </Button>

          {onSkip && (
            <Button
              variant="ghost"
              onClick={onSkip}
              disabled={isLoading}
              className="w-full"
            >
              Skip for now
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-3">
          <div className="p-2 bg-gradient-primary rounded-lg">
            <CreditCard className="w-5 h-5 text-primary-foreground" />
          </div>
          Add Payment Method
        </CardTitle>
        <CardDescription>
          Choose to add a credit card or bank account
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Elements 
          stripe={stripePromise}
          options={{
            clientSecret,
            appearance: {
              theme: 'stripe',
            },
          }}
        >
          <PaymentMethodForm onComplete={onComplete} onSkip={onSkip} />
        </Elements>
      </CardContent>
    </Card>
  );
}
