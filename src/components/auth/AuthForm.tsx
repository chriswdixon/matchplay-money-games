import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/useAuth';
import { ArrowLeft, Shield, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { signUpSchema, signInSchema, passwordResetSchema, RateLimiter, inviteCodeSchema } from '@/lib/validation';
import { checkPasswordSecurity } from '@/lib/utils';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { MFAEnrollment } from './MFAEnrollment';
import { MFAVerification } from './MFAVerification';
import { PaymentMethodSetup } from './PaymentMethodSetup';
import { SubscriptionSelection } from './SubscriptionSelection';
import { useInvites } from '@/hooks/useInvites';
import { InstallPrompt } from '@/components/InstallPrompt';

export function AuthForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [showResetForm, setShowResetForm] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [passwordWarnings, setPasswordWarnings] = useState<string[]>([]);
  const [magicLinkLoading, setMagicLinkLoading] = useState(false);
  const [showMFAEnrollment, setShowMFAEnrollment] = useState(false);
  const [showMFAVerification, setShowMFAVerification] = useState(false);
  const [needsMFASetup, setNeedsMFASetup] = useState(false);
  const [showSubscriptionSelection, setShowSubscriptionSelection] = useState(false);
  const [showPaymentSetup, setShowPaymentSetup] = useState(false);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [showRequestInvite, setShowRequestInvite] = useState(false);
  const [requestInviteLoading, setRequestInviteLoading] = useState(false);
  const { signIn, signUp, signInWithMagicLink } = useAuth();
  const { toast } = useToast();
  const { validateInvite, linkInviteToUser } = useInvites();
  
  // Initialize rate limiter for auth attempts
  const rateLimiter = new RateLimiter(3, 15 * 60 * 1000); // 3 attempts per 15 minutes

  useEffect(() => {
    // Check if user needs MFA setup after sign-in
    const checkMFAStatus = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
        if (data?.currentLevel === 'aal1' && data?.nextLevel === 'aal2') {
          setShowMFAVerification(true);
        }
      }
    };
    checkMFAStatus();
  }, []);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationErrors({});
    
    // Rate limiting check
    const clientId = `signin-${email}`;
    if (!rateLimiter.isAllowed(clientId)) {
      const remainingTime = Math.ceil(rateLimiter.getRemainingTime(clientId) / 1000 / 60);
      toast({
        title: "Too many attempts",
        description: `Please wait ${remainingTime} minutes before trying again.`,
        variant: "destructive",
      });
      return;
    }
    
    // Validate input
    const validation = signInSchema.safeParse({ email, password });
    if (!validation.success) {
      const errors: Record<string, string> = {};
      validation.error.errors.forEach((error) => {
        errors[error.path[0] as string] = error.message;
      });
      setValidationErrors(errors);
      return;
    }
    
    setLoading(true);
    const { error } = await signIn(email, password);
    
    if (!error) {
      // Check if MFA verification is required
      const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (data?.currentLevel === 'aal1' && data?.nextLevel === 'aal2') {
        setShowMFAVerification(true);
      }
    }
    
    setLoading(false);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationErrors({});
    
    // Rate limiting check
    const clientId = `signup-${email}`;
    if (!rateLimiter.isAllowed(clientId)) {
      const remainingTime = Math.ceil(rateLimiter.getRemainingTime(clientId) / 1000 / 60);
      toast({
        title: "Too many attempts",
        description: `Please wait ${remainingTime} minutes before trying again.`,
        variant: "destructive",
      });
      return;
    }
    
    // Validate input
    const finalDisplayName = displayName.trim() || `${firstName} ${lastName}`.trim();
    const validation = signUpSchema.safeParse({ 
      email, 
      password, 
      firstName,
      lastName,
      displayName: finalDisplayName,
      dateOfBirth 
    });
    if (!validation.success) {
      const errors: Record<string, string> = {};
      validation.error.errors.forEach((error) => {
        errors[error.path[0] as string] = error.message;
      });
      setValidationErrors(errors);
      return;
    }

    // Validate invite code (unless @match-play.co email)
    if (!email.endsWith('@match-play.co')) {
      // Validate invite code format
      try {
        inviteCodeSchema.parse(inviteCode);
      } catch (error: any) {
        setValidationErrors({ inviteCode: error.errors?.[0]?.message || 'Invalid invite code format' });
        return;
      }

      const inviteResult = await validateInvite(inviteCode, email);
      if (!inviteResult.valid) {
        setValidationErrors({ inviteCode: inviteResult.error || 'Invalid invite code' });
        return;
      }
    }
    
    setLoading(true);
    const { error } = await signUp(email, password, finalDisplayName, firstName, lastName);
    
    if (!error) {
      // Store date of birth in private profile data
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // Create private profile with date of birth
        await supabase
          .from('private_profile_data')
          .insert({
            user_id: user.id,
            date_of_birth: dateOfBirth,
          });

        // Link invite to user
        if (inviteCode) {
          await linkInviteToUser(inviteCode, user.id);
        }
      }

      // Require MFA enrollment for new users
      setShowMFAEnrollment(true);
      setNeedsMFASetup(true);
      toast({
        title: "Account Created",
        description: "Please set up two-factor authentication to secure your account",
      });
    }
    
    setLoading(false);
  };


  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationErrors({});
    
    // Validate email
    const validation = passwordResetSchema.safeParse({ email: resetEmail });
    if (!validation.success) {
      const errors: Record<string, string> = {};
      validation.error.errors.forEach((error) => {
        errors[error.path[0] as string] = error.message;
      });
      setValidationErrors(errors);
      return;
    }
    
    setResetLoading(true);
    
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });
      
      if (error) {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Reset link sent",
          description: "Check your email for the password reset link. It will expire in 1 hour.",
        });
        setShowResetForm(false);
        setResetEmail('');
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to send reset email. Please try again.",
        variant: "destructive",
      });
    }
    
    setResetLoading(false);
  };

  // Password security check on change
  const handlePasswordChange = async (value: string) => {
    setPassword(value);
    if (value.length > 0) {
      const { warnings } = await checkPasswordSecurity(value);
      setPasswordWarnings(warnings);
    } else {
      setPasswordWarnings([]);
    }
  };

  const handleMagicLink = async () => {
    setValidationErrors({});
    
    // Validate email
    const validation = passwordResetSchema.safeParse({ email });
    if (!validation.success) {
      const errors: Record<string, string> = {};
      validation.error.errors.forEach((error) => {
        errors[error.path[0] as string] = error.message;
      });
      setValidationErrors(errors);
      return;
    }
    
    setMagicLinkLoading(true);
    await signInWithMagicLink(email);
    setMagicLinkLoading(false);
  };

  const handleRequestInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationErrors({});
    
    if (!firstName || !lastName || !email) {
      toast({
        title: "Missing Information",
        description: "Please fill in all fields to request an invite",
        variant: "destructive",
      });
      return;
    }

    setRequestInviteLoading(true);

    try {
      const { error } = await supabase.functions.invoke('request-invite', {
        body: {
          firstName,
          lastName,
          email,
        },
      });

      if (error) throw error;

      toast({
        title: "Request Submitted",
        description: "We'll send you an invite code shortly. Check your email!",
      });
      setShowRequestInvite(false);
    } catch (error: any) {
      console.error('Error requesting invite:', error);
      toast({
        title: "Request Failed",
        description: error.message || "Failed to submit invite request. Please try again.",
        variant: "destructive",
      });
    } finally {
      setRequestInviteLoading(false);
    }
  };

  // Show subscription selection after signup
  if (showSubscriptionSelection) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-subtle px-4 py-8">
        <SubscriptionSelection 
          onComplete={() => {
            setShowSubscriptionSelection(false);
            setShowPaymentSetup(true);
            toast({
              title: "Subscription Selected",
              description: "Now let's add a payment method to complete your setup",
            });
          }}
        />
      </div>
    );
  }

  // Show payment setup after subscription
  if (showPaymentSetup) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-subtle px-4 py-8">
        <PaymentMethodSetup 
          onComplete={() => {
            setShowPaymentSetup(false);
            setShowInstallPrompt(true);
            toast({
              title: "Setup Complete",
              description: "Welcome to MatchPlay! You're all set to join matches.",
            });
          }}
          onSkip={() => {
            setShowPaymentSetup(false);
            setShowInstallPrompt(true);
            toast({
              title: "Setup Complete",
              description: "You can add a payment method later in your profile.",
            });
          }}
        />
      </div>
    );
  }

  // Show install prompt after signup completion
  if (showInstallPrompt) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-subtle px-4 py-8">
        <div className="w-full max-w-md space-y-4">
          <InstallPrompt 
            forceShow={true}
            onDismiss={() => setShowInstallPrompt(false)}
          />
          <Card>
            <CardContent className="pt-6 text-center space-y-4">
              <h3 className="text-lg font-semibold">You're All Set! 🎉</h3>
              <p className="text-sm text-muted-foreground">
                Install MatchPlay on your device for the best experience on the course.
              </p>
              <Button 
                onClick={() => setShowInstallPrompt(false)}
                className="w-full"
              >
                Continue to App
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (showMFAEnrollment) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-subtle px-4 py-8">
        <MFAEnrollment
          onComplete={() => {
            setShowMFAEnrollment(false);
            if (needsMFASetup) {
              // After MFA setup for new users, show subscription selection
              setShowSubscriptionSelection(true);
              toast({
                title: "MFA Setup Complete",
                description: "Now let's choose your subscription plan",
              });
            } else {
              toast({
                title: "Welcome to MatchPlay",
                description: "Your account is now secured with two-factor authentication",
              });
            }
          }}
          isRequired={needsMFASetup}
        />
      </div>
    );
  }

  // Show MFA verification during sign-in
  if (showMFAVerification) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-subtle px-4">
        <MFAVerification
          onVerified={() => {
            setShowMFAVerification(false);
            toast({
              title: "Welcome Back",
              description: "You've successfully signed in",
            });
          }}
          onCancel={async () => {
            await supabase.auth.signOut();
            setShowMFAVerification(false);
          }}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-subtle px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">
            {showResetForm ? 'Reset Password' : 'Welcome to MatchPlay'}
          </CardTitle>
          <CardDescription>
            {showResetForm 
              ? 'Enter your email to receive a password reset link'
              : 'Join the premier golf matchmaking platform'
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          {showResetForm ? (
            <div className="space-y-4">
              <Button
                variant="ghost"
                onClick={() => setShowResetForm(false)}
                className="mb-4 p-0 h-auto font-normal text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to sign in
              </Button>
              
              <form onSubmit={handlePasswordReset} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="reset-email">Email</Label>
                  <Input
                    id="reset-email"
                    type="email"
                    placeholder="your@email.com"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    required
                    className={validationErrors.email ? "border-destructive" : ""}
                  />
                  {validationErrors.email && (
                    <p className="text-sm text-destructive">{validationErrors.email}</p>
                  )}
                </div>
                <Button type="submit" className="w-full" disabled={resetLoading}>
                  {resetLoading ? "Sending reset link..." : "Send Reset Link"}
                </Button>
              </form>
            </div>
          ) : (
            <>
              <Tabs defaultValue="signin" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="signin">Sign In</TabsTrigger>
                  <TabsTrigger value="signup">Sign Up</TabsTrigger>
                </TabsList>
                
                <TabsContent value="signin">
                  <form onSubmit={handleSignIn} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="signin-email">Email</Label>
                      <Input
                        id="signin-email"
                        type="email"
                        placeholder="your@email.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className={validationErrors.email ? "border-destructive" : ""}
                      />
                      {validationErrors.email && (
                        <p className="text-sm text-destructive">{validationErrors.email}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signin-password">Password</Label>
                      <Input
                        id="signin-password"
                        type="password"
                        placeholder="Enter your password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className={validationErrors.password ? "border-destructive" : ""}
                      />
                      {validationErrors.password && (
                        <p className="text-sm text-destructive">{validationErrors.password}</p>
                      )}
                    </div>
                    <div className="flex justify-end">
                      <Button
                        type="button"
                        variant="link"
                        onClick={() => setShowResetForm(true)}
                        className="p-0 h-auto text-sm text-muted-foreground hover:text-primary"
                      >
                        Forgot password?
                      </Button>
                    </div>
                    <Button type="submit" className="w-full" disabled={loading}>
                      {loading ? "Signing in..." : "Sign In"}
                    </Button>
                    
                    <div className="relative my-4">
                      <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t" />
                      </div>
                      <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-background px-2 text-muted-foreground">
                          Or
                        </span>
                      </div>
                    </div>
                    
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleMagicLink}
                      disabled={magicLinkLoading || !email}
                      className="w-full"
                    >
                      {magicLinkLoading ? "Sending magic link..." : "Send me a magic link"}
                    </Button>
                  </form>
                </TabsContent>
                
                <TabsContent value="signup">
                  <form onSubmit={handleSignUp} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="signup-firstname">First Name</Label>
                        <Input
                          id="signup-firstname"
                          type="text"
                          placeholder="John"
                          value={firstName}
                          onChange={(e) => setFirstName(e.target.value)}
                          required
                          className={validationErrors.firstName ? "border-destructive" : ""}
                        />
                        {validationErrors.firstName && (
                          <p className="text-sm text-destructive">{validationErrors.firstName}</p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="signup-lastname">Last Name</Label>
                        <Input
                          id="signup-lastname"
                          type="text"
                          placeholder="Doe"
                          value={lastName}
                          onChange={(e) => setLastName(e.target.value)}
                          required
                          className={validationErrors.lastName ? "border-destructive" : ""}
                        />
                        {validationErrors.lastName && (
                          <p className="text-sm text-destructive">{validationErrors.lastName}</p>
                        )}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-name">Display Name (Optional)</Label>
                      <Input
                        id="signup-name"
                        type="text"
                        placeholder="Leave blank to use First + Last"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        className={validationErrors.displayName ? "border-destructive" : ""}
                      />
                      {validationErrors.displayName && (
                        <p className="text-sm text-destructive">{validationErrors.displayName}</p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        This is how other players will see you
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-email">Email</Label>
                      <Input
                        id="signup-email"
                        type="email"
                        placeholder="your@email.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className={validationErrors.email ? "border-destructive" : ""}
                      />
                      {validationErrors.email && (
                        <p className="text-sm text-destructive">{validationErrors.email}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-dob">Date of Birth</Label>
                      <Input
                        id="signup-dob"
                        type="date"
                        value={dateOfBirth}
                        onChange={(e) => setDateOfBirth(e.target.value)}
                        required
                        className={validationErrors.dateOfBirth ? "border-destructive" : ""}
                      />
                      {validationErrors.dateOfBirth && (
                        <p className="text-sm text-destructive">{validationErrors.dateOfBirth}</p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        You must be 18+ to participate in skill-based competitions
                      </p>
                    </div>
                    {!email.endsWith('@match-play.co') && (
                      <div className="space-y-2">
                        <Label htmlFor="invite-code">Invite Code</Label>
                        <Input
                          id="invite-code"
                          type="text"
                          placeholder="Enter your invite code"
                          value={inviteCode}
                          onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                          required={!showRequestInvite}
                          className={validationErrors.inviteCode ? "border-destructive" : ""}
                        />
                        {validationErrors.inviteCode && (
                          <p className="text-sm text-destructive">{validationErrors.inviteCode}</p>
                        )}
                        <div className="flex items-center justify-between">
                          <p className="text-xs text-muted-foreground">
                            Beta invites are required to sign up
                          </p>
                          <Button
                            type="button"
                            variant="link"
                            onClick={() => setShowRequestInvite(true)}
                            className="p-0 h-auto text-xs"
                          >
                            Request an Invite
                          </Button>
                        </div>
                      </div>
                    )}
                    <div className="space-y-2">
                      <Label htmlFor="signup-password" className="flex items-center gap-2">
                        Password
                        <Shield className="w-4 h-4 text-muted-foreground" />
                      </Label>
                      <Input
                        id="signup-password"
                        type="password"
                        placeholder="Create a strong password"
                        value={password}
                        onChange={(e) => handlePasswordChange(e.target.value)}
                        required
                        className={validationErrors.password ? "border-destructive" : ""}
                      />
                      {validationErrors.password && (
                        <p className="text-sm text-destructive">{validationErrors.password}</p>
                      )}
                      {passwordWarnings.length > 0 && (
                        <Alert className="mt-2">
                          <AlertCircle className="h-4 w-4" />
                          <AlertDescription>
                            <div className="space-y-1">
                              {passwordWarnings.map((warning, index) => (
                                <div key={index} className="text-sm">• {warning}</div>
                              ))}
                            </div>
                          </AlertDescription>
                        </Alert>
                      )}
                    </div>
                    <Button type="submit" className="w-full" disabled={loading}>
                      {loading ? "Creating account..." : "Sign Up"}
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>

            </>
          )}
        </CardContent>
      </Card>

      {/* Request Invite Dialog */}
      <Dialog open={showRequestInvite} onOpenChange={setShowRequestInvite}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request an Invite Code</DialogTitle>
            <DialogDescription>
              Fill out your information and we'll send you an invite code via email
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleRequestInvite} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="request-firstname">First Name</Label>
                <Input
                  id="request-firstname"
                  type="text"
                  placeholder="John"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="request-lastname">Last Name</Label>
                <Input
                  id="request-lastname"
                  type="text"
                  placeholder="Doe"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="request-email">Email</Label>
              <Input
                id="request-email"
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowRequestInvite(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={requestInviteLoading}
                className="flex-1"
              >
                {requestInviteLoading ? "Submitting..." : "Submit Request"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}