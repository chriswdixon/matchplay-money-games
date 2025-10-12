import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Mail, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAuth } from '@/hooks/useAuth';

interface EmailConfirmationPendingProps {
  email: string;
  onBack: () => void;
}

export function EmailConfirmationPending({ email, onBack }: EmailConfirmationPendingProps) {
  const [resendCooldown, setResendCooldown] = useState(0);
  const [isResending, setIsResending] = useState(false);
  const { resendConfirmationEmail } = useAuth();

  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const handleResend = async () => {
    setIsResending(true);
    const { error } = await resendConfirmationEmail(email);
    setIsResending(false);
    
    if (!error) {
      setResendCooldown(60); // 60 second cooldown
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-subtle px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="rounded-full bg-primary/10 p-3">
              <Mail className="h-8 w-8 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">Check your email</CardTitle>
          <CardDescription>
            We've sent a confirmation link to
            <div className="font-semibold text-foreground mt-1">{email}</div>
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-2">
                <p className="font-semibold">Important:</p>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li>You must confirm your email before you can sign in</li>
                  <li>Check your spam folder if you don't see the email</li>
                  <li>The confirmation link will expire in 24 hours</li>
                </ul>
              </div>
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Button
              onClick={handleResend}
              disabled={resendCooldown > 0 || isResending}
              className="w-full"
              variant="outline"
            >
              {isResending
                ? 'Sending...'
                : resendCooldown > 0
                ? `Resend in ${resendCooldown}s`
                : 'Resend confirmation email'}
            </Button>
            
            <Button
              onClick={onBack}
              variant="ghost"
              className="w-full"
            >
              Back to sign in
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
