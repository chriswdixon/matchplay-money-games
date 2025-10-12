import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Shield, Copy, CheckCircle2 } from 'lucide-react';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';

interface MFAEnrollmentProps {
  onComplete: () => void;
  isRequired?: boolean;
}

export function MFAEnrollment({ onComplete, isRequired = false }: MFAEnrollmentProps) {
  const [qrCode, setQrCode] = useState<string>('');
  const [secret, setSecret] = useState<string>('');
  const [verificationCode, setVerificationCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [enrolling, setEnrolling] = useState(false);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    enrollMFA();
  }, []);

  const enrollMFA = async () => {
    setEnrolling(true);
    try {
      // Check if user has a valid session first
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error("Please confirm your email before setting up MFA");
      }

      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
      });

      if (error) throw error;

      if (data) {
        setQrCode(data.totp.qr_code);
        setSecret(data.totp.secret);
      }
    } catch (error: any) {
      // Generic error message to prevent enumeration attacks
      toast({
        title: "Setup Failed",
        description: "Unable to set up two-factor authentication. Please ensure your account is fully activated and try again.",
        variant: "destructive",
      });
    } finally {
      setEnrolling(false);
    }
  };

  const verifyAndEnable = async () => {
    if (verificationCode.length !== 6) {
      toast({
        title: "Invalid Code",
        description: "Please enter a 6-digit code from your authenticator app",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const factors = await supabase.auth.mfa.listFactors();
      if (factors.error) throw factors.error;

      const totpFactor = factors.data?.totp?.[0];
      if (!totpFactor) throw new Error("No MFA factor found");

      const { data, error } = await supabase.auth.mfa.challengeAndVerify({
        factorId: totpFactor.id,
        code: verificationCode,
      });

      if (error) throw error;

      toast({
        title: "MFA Enabled",
        description: "Two-factor authentication has been successfully enabled",
      });
      
      onComplete();
    } catch (error: any) {
      toast({
        title: "Verification Failed",
        description: error.message || "Invalid verification code. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const copySecret = async () => {
    try {
      await navigator.clipboard.writeText(secret);
      setCopied(true);
      toast({
        title: "Copied",
        description: "Secret key copied to clipboard",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast({
        title: "Copy Failed",
        description: "Failed to copy secret key",
        variant: "destructive",
      });
    }
  };

  if (enrolling) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardContent className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center">
        <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
          <Shield className="w-6 h-6 text-primary" />
        </div>
        <CardTitle className="text-2xl font-bold">
          {isRequired ? "Enable Two-Factor Authentication" : "Set Up MFA"}
        </CardTitle>
        <CardDescription>
          {isRequired 
            ? "For your security, MFA is required for all accounts"
            : "Add an extra layer of security to your account"
          }
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Step 1: Scan QR Code */}
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-semibold">
              1
            </div>
            <div className="flex-1">
              <h3 className="font-semibold mb-2">Scan QR Code</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Use an authenticator app like Google Authenticator, Authy, or 1Password to scan this QR code:
              </p>
              {qrCode && (
                <div className="bg-white p-4 rounded-lg inline-block">
                  <img src={qrCode} alt="MFA QR Code" className="w-48 h-48" />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Step 2: Manual Entry Option */}
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-semibold">
              2
            </div>
            <div className="flex-1">
              <h3 className="font-semibold mb-2">Or Enter Manually</h3>
              <p className="text-sm text-muted-foreground mb-3">
                If you can't scan the QR code, enter this secret key manually:
              </p>
              <div className="flex gap-2">
                <Input
                  value={secret}
                  readOnly
                  className="font-mono text-sm"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={copySecret}
                >
                  {copied ? (
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Step 3: Verify */}
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-semibold">
              3
            </div>
            <div className="flex-1">
              <h3 className="font-semibold mb-2">Enter Verification Code</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Enter the 6-digit code from your authenticator app:
              </p>
              <div className="flex flex-col items-center gap-4">
                <InputOTP
                  maxLength={6}
                  value={verificationCode}
                  onChange={setVerificationCode}
                >
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                    <InputOTPSlot index={3} />
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>
              </div>
            </div>
          </div>
        </div>

        <Button
          onClick={verifyAndEnable}
          disabled={loading || verificationCode.length !== 6}
          className="w-full"
        >
          {loading ? "Verifying..." : "Enable Two-Factor Authentication"}
        </Button>

        {!isRequired && (
          <Button
            variant="ghost"
            onClick={onComplete}
            className="w-full"
          >
            Skip for Now
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
