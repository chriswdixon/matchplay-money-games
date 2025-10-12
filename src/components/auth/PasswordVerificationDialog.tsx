import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { AlertCircle, Lock } from 'lucide-react';

interface PasswordVerificationDialogProps {
  open: boolean;
  onVerified: () => void;
  onCancel: () => void;
  title?: string;
  description?: string;
}

export function PasswordVerificationDialog({ 
  open, 
  onVerified, 
  onCancel,
  title = "Verify Your Password",
  description = "For security, please verify your password to continue."
}: PasswordVerificationDialogProps) {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { toast } = useToast();

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) throw new Error('User email not found');

      // Re-authenticate with email and password
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password,
      });

      if (signInError) {
        setError('Incorrect password. Please try again.');
        setLoading(false);
        return;
      }

      toast({
        title: "Verification successful",
        description: "You can now access this section.",
      });
      
      setPassword('');
      onVerified();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed');
      toast({
        title: "Verification failed",
        description: err instanceof Error ? err.message : 'Please try again',
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setPassword('');
    setError('');
    onCancel();
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="w-5 h-5" />
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleVerify} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
              autoFocus
            />
            {error && (
              <div className="flex items-center gap-2 text-sm text-destructive">
                <AlertCircle className="w-4 h-4" />
                {error}
              </div>
            )}
          </div>
          <div className="flex gap-3">
            <Button type="button" variant="outline" onClick={handleCancel} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !password} className="flex-1">
              {loading ? "Verifying..." : "Verify"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
