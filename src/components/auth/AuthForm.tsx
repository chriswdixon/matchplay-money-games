import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/useAuth';
import { ArrowLeft, Shield, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { signUpSchema, signInSchema, passwordResetSchema, RateLimiter } from '@/lib/validation';
import { checkPasswordSecurity } from '@/lib/utils';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { SubscriptionSelection } from './SubscriptionSelection';
import { Dialog, DialogContent } from '@/components/ui/dialog';

export function AuthForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [showResetForm, setShowResetForm] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [passwordWarnings, setPasswordWarnings] = useState<string[]>([]);
  const [magicLinkLoading, setMagicLinkLoading] = useState(false);
  const [showSubscriptionSelection, setShowSubscriptionSelection] = useState(false);
  const { signIn, signUp, signInWithMagicLink } = useAuth();
  const { toast } = useToast();
  
  // Initialize rate limiter for auth attempts
  const rateLimiter = new RateLimiter(3, 15 * 60 * 1000); // 3 attempts per 15 minutes

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
    await signIn(email, password);
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
    const validation = signUpSchema.safeParse({ email, password, displayName });
    if (!validation.success) {
      const errors: Record<string, string> = {};
      validation.error.errors.forEach((error) => {
        errors[error.path[0] as string] = error.message;
      });
      setValidationErrors(errors);
      return;
    }
    
    setLoading(true);
    const { error } = await signUp(email, password, displayName);
    setLoading(false);
    
    if (!error) {
      // Show subscription selection dialog after successful sign up
      setShowSubscriptionSelection(true);
    }
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

  return (
    <>
      <Dialog open={showSubscriptionSelection} onOpenChange={setShowSubscriptionSelection}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <SubscriptionSelection onComplete={() => setShowSubscriptionSelection(false)} />
        </DialogContent>
      </Dialog>

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
                    <div className="space-y-2">
                      <Label htmlFor="signup-name">Display Name</Label>
                      <Input
                        id="signup-name"
                        type="text"
                        placeholder="Your golf name"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        className={validationErrors.displayName ? "border-destructive" : ""}
                      />
                      {validationErrors.displayName && (
                        <p className="text-sm text-destructive">{validationErrors.displayName}</p>
                      )}
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
    </div>
    </>
  );
}