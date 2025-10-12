import { useState, useEffect } from 'react';
import { AlertCircle, X, Mail } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

export function EmailConfirmationBanner() {
  const [showBanner, setShowBanner] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const [isResending, setIsResending] = useState(false);
  const { user, resendConfirmationEmail } = useAuth();

  useEffect(() => {
    const checkEmailConfirmation = async () => {
      if (user) {
        // Check if email is confirmed
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        if (currentUser && !currentUser.email_confirmed_at) {
          setShowBanner(true);
          setUserEmail(currentUser.email || '');
        } else {
          setShowBanner(false);
        }
      } else {
        setShowBanner(false);
      }
    };

    checkEmailConfirmation();
  }, [user]);

  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const handleResend = async () => {
    if (!userEmail) return;
    
    setIsResending(true);
    const { error } = await resendConfirmationEmail(userEmail);
    setIsResending(false);
    
    if (!error) {
      setResendCooldown(60);
    }
  };

  if (!showBanner) return null;

  return (
    <Alert className="rounded-none border-x-0 border-t-0 bg-destructive text-destructive-foreground">
      <AlertCircle className="h-4 w-4" />
      <AlertDescription className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 flex-1">
          <Mail className="h-4 w-4" />
          <span className="text-sm">
            Please confirm your email address ({userEmail}). Check your inbox for a confirmation link.
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleResend}
            disabled={resendCooldown > 0 || isResending}
            className="bg-background text-foreground hover:bg-background/90"
          >
            {isResending
              ? 'Sending...'
              : resendCooldown > 0
              ? `Resend (${resendCooldown}s)`
              : 'Resend Email'}
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}
