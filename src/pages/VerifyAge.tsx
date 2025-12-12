import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";

const VerifyAge = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'already_verified'>('loading');
  const [message, setMessage] = useState('');
  const token = searchParams.get('token');

  useEffect(() => {
    const verifyToken = async () => {
      if (!token) {
        setStatus('error');
        setMessage('No verification token provided');
        return;
      }

      try {
        const { data, error } = await supabase.functions.invoke('verify-age-token', {
          body: { token }
        });

        if (error) throw error;

        if (data.alreadyVerified) {
          setStatus('already_verified');
          setMessage('Your age has already been verified.');
        } else {
          setStatus('success');
          setMessage(data.message || 'Age successfully verified!');
        }
      } catch (error: any) {
        console.error('Verification error:', error);
        setStatus('error');
        setMessage(error.message || 'Failed to verify age. Please try again.');
      }
    };

    verifyToken();
  }, [token]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-subtle px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          {status === 'loading' && (
            <>
              <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <Loader2 className="h-8 w-8 text-primary animate-spin" />
              </div>
              <CardTitle>Verifying Your Age...</CardTitle>
            </>
          )}
          
          {(status === 'success' || status === 'already_verified') && (
            <>
              <div className="mx-auto w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mb-4">
                <CheckCircle className="h-8 w-8 text-green-500" />
              </div>
              <CardTitle className="text-green-600">
                {status === 'already_verified' ? 'Already Verified' : 'Age Verified!'}
              </CardTitle>
            </>
          )}
          
          {status === 'error' && (
            <>
              <div className="mx-auto w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
                <XCircle className="h-8 w-8 text-destructive" />
              </div>
              <CardTitle className="text-destructive">Verification Failed</CardTitle>
            </>
          )}
        </CardHeader>
        
        <CardContent className="text-center space-y-6">
          <p className="text-muted-foreground">{message}</p>
          
          {status === 'success' && (
            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 space-y-2">
              <p className="text-sm font-medium text-green-800 dark:text-green-200">
                What's next?
              </p>
              <p className="text-sm text-green-700 dark:text-green-300">
                You now have full access to MatchPlay. Find matches, compete with other golfers, 
                and earn prizes based on your skills!
              </p>
            </div>
          )}
          
          {status === 'error' && (
            <div className="bg-destructive/10 rounded-lg p-4 space-y-2">
              <p className="text-sm text-destructive">
                If your link has expired, please log in and request a new verification email 
                from your profile settings.
              </p>
            </div>
          )}
          
          <Button onClick={() => navigate('/')} className="w-full">
            {status === 'success' ? 'Start Playing' : 'Go to Homepage'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default VerifyAge;
