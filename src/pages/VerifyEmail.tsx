import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function VerifyEmail() {
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [errorMessage, setErrorMessage] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const handleEmailVerification = async () => {
      try {
        // Check if we have a valid session after email verification
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          setStatus('error');
          setErrorMessage(error.message);
          return;
        }

        if (session) {
          setStatus('success');
          
          // Check if user needs MFA setup
          const { data: mfaData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
          
          // Redirect after a brief delay
          setTimeout(() => {
            if (mfaData?.currentLevel === 'aal1' && mfaData?.nextLevel === 'aal2') {
              // User needs MFA verification
              navigate('/auth', { replace: true });
            } else {
              // User is fully authenticated
              navigate('/', { replace: true });
            }
          }, 2000);
        } else {
          // No session means the token was invalid or expired
          setStatus('error');
          setErrorMessage('Email link is invalid or has expired. Please request a new confirmation email.');
        }
      } catch (error: any) {
        setStatus('error');
        setErrorMessage(error.message || 'An unexpected error occurred');
      }
    };

    handleEmailVerification();
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-subtle px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            {status === 'verifying' && <Loader2 className="h-12 w-12 animate-spin text-primary" />}
            {status === 'success' && <CheckCircle2 className="h-12 w-12 text-green-500" />}
            {status === 'error' && <XCircle className="h-12 w-12 text-destructive" />}
          </div>
          <CardTitle className="text-2xl font-bold">
            {status === 'verifying' && 'Verifying your email...'}
            {status === 'success' && 'Email confirmed!'}
            {status === 'error' && 'Verification failed'}
          </CardTitle>
          <CardDescription>
            {status === 'verifying' && 'Please wait while we confirm your email address'}
            {status === 'success' && 'Redirecting you to complete your account setup...'}
            {status === 'error' && errorMessage}
          </CardDescription>
        </CardHeader>
        
        {status === 'error' && (
          <CardContent className="text-center">
            <Button
              onClick={() => navigate('/auth')}
              className="w-full"
            >
              Go to Sign In
            </Button>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
