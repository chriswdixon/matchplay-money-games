import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Shield, ShieldCheck, ShieldAlert } from 'lucide-react';
import { MFAEnrollment } from '@/components/auth/MFAEnrollment';
import { Badge } from '@/components/ui/badge';

export function MFASettings() {
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showEnrollment, setShowEnrollment] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    checkMFAStatus();
  }, []);

  const checkMFAStatus = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) throw error;
      
      const hasTOTP = data?.totp && data.totp.length > 0;
      setMfaEnabled(hasTOTP);
    } catch (error: any) {
      console.error('Error checking MFA status:', error);
    } finally {
      setLoading(false);
    }
  };

  const disableMFA = async () => {
    try {
      const { data: factors, error: listError } = await supabase.auth.mfa.listFactors();
      if (listError) throw listError;

      const totpFactor = factors?.totp?.[0];
      if (!totpFactor) throw new Error("No MFA factor found");

      const { error } = await supabase.auth.mfa.unenroll({ factorId: totpFactor.id });
      if (error) throw error;

      setMfaEnabled(false);
      toast({
        title: "MFA Disabled",
        description: "Two-factor authentication has been disabled",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to disable MFA",
        variant: "destructive",
      });
    }
  };

  if (showEnrollment) {
    return (
      <MFAEnrollment
        onComplete={() => {
          setShowEnrollment(false);
          checkMFAStatus();
        }}
        isRequired={false}
      />
    );
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Two-Factor Authentication
            </CardTitle>
            <CardDescription>
              Add an extra layer of security to your account
            </CardDescription>
          </div>
          {mfaEnabled ? (
            <Badge variant="default" className="gap-1">
              <ShieldCheck className="w-3 h-3" />
              Enabled
            </Badge>
          ) : (
            <Badge variant="secondary" className="gap-1">
              <ShieldAlert className="w-3 h-3" />
              Disabled
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {mfaEnabled ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950 p-4">
              <div className="flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5" />
                <div>
                  <p className="font-medium text-green-900 dark:text-green-100">
                    Your account is protected
                  </p>
                  <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                    Two-factor authentication is currently active on your account. You'll need your authenticator app to sign in.
                  </p>
                </div>
              </div>
            </div>
            <Button
              variant="destructive"
              onClick={disableMFA}
            >
              Disable Two-Factor Authentication
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950 p-4">
              <div className="flex items-start gap-3">
                <ShieldAlert className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5" />
                <div>
                  <p className="font-medium text-amber-900 dark:text-amber-100">
                    Enhance your account security
                  </p>
                  <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                    Enable two-factor authentication to add an extra layer of protection to your account, especially important for payment security.
                  </p>
                </div>
              </div>
            </div>
            <Button
              onClick={() => setShowEnrollment(true)}
              className="gap-2"
            >
              <Shield className="w-4 h-4" />
              Enable Two-Factor Authentication
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
