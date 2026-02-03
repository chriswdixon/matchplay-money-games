import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Wallet, Info, CheckCircle } from 'lucide-react';

interface PaymentMethodSetupProps {
  onComplete: () => void;
  onSkip?: () => void;
}

export function PaymentMethodSetup({ onComplete, onSkip }: PaymentMethodSetupProps) {
  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-3">
          <div className="p-2 bg-gradient-primary rounded-lg">
            <Wallet className="w-5 h-5 text-primary-foreground" />
          </div>
          Play Money Account
        </CardTitle>
        <CardDescription>
          Your account is ready to play with $500 in play money
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-start gap-3 p-4 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
          <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 shrink-0" />
          <div className="space-y-1">
            <p className="text-sm font-medium text-green-800 dark:text-green-200">
              You're all set!
            </p>
            <p className="text-sm text-green-700 dark:text-green-300">
              Your account has been credited with $500 in play money. Use it to join matches and win more!
            </p>
          </div>
        </div>

        <div className="bg-muted/50 rounded-lg p-4 space-y-2">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-muted-foreground" />
            <p className="text-sm text-muted-foreground font-medium">
              How play money works:
            </p>
          </div>
          <ul className="text-sm space-y-1 list-disc list-inside text-muted-foreground">
            <li>Match buy-ins are deducted from your balance</li>
            <li>Win matches to earn more play money</li>
            <li>Climb the leaderboard by accumulating winnings</li>
          </ul>
        </div>

        <Button
          onClick={onComplete}
          className="w-full bg-gradient-primary"
        >
          Get Started
        </Button>

        {onSkip && (
          <Button
            variant="ghost"
            onClick={onSkip}
            className="w-full"
          >
            Skip for now
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
