import { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { validateSessionToken } from '@/lib/validation';
import { isValidSessionAge } from '@/lib/utils';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string, displayName?: string) => Promise<{ error: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<{ error: any }>;
  signInWithProvider: (provider: 'google' | 'github' | 'twitter') => Promise<{ error: any }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        // Enhanced session validation
        if (session) {
          // Validate session token format
          if (!validateSessionToken(session.access_token)) {
            console.warn('Invalid session token format detected');
            supabase.auth.signOut();
            return;
          }
          
          // Check session age (auto-logout after 24 hours of inactivity)
          if (!isValidSessionAge(session.user.created_at, 24)) {
            console.warn('Session expired due to age');
            toast({
              title: "Session expired",
              description: "Please sign in again for security.",
              variant: "destructive",
            });
            supabase.auth.signOut();
            return;
          }
        }
        
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
        
        if (event === 'SIGNED_IN') {
          // Log successful authentication securely (no sensitive data)
          console.log('User authenticated successfully');
          toast({
            title: "Welcome to MatchPlay!",
            description: "You've successfully signed in.",
          });
        } else if (event === 'SIGNED_OUT') {
          // Clear any cached data on logout
          setSession(null);
          setUser(null);
          toast({
            title: "Signed out",
            description: "You've been signed out successfully.",
          });
        } else if (event === 'PASSWORD_RECOVERY') {
          toast({
            title: "Password reset",
            description: "Follow the instructions in your email to reset your password.",
          });
        }
      }
    );

    // Get initial session with validation
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session && (!validateSessionToken(session.access_token) || 
                     !isValidSessionAge(session.user.created_at, 24))) {
        supabase.auth.signOut();
        return;
      }
      
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [toast]);

  const signUp = async (email: string, password: string, displayName?: string) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: displayName ? { display_name: displayName } : undefined
      }
    });

    if (error) {
      toast({
        title: "Sign up failed",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Check your email",
        description: "We've sent you a confirmation link.",
      });
    }

    return { error };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      toast({
        title: "Sign in failed",
        description: error.message,
        variant: "destructive",
      });
    }

    return { error };
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    return { error };
  };

  const signInWithProvider = async (provider: 'google' | 'github' | 'twitter') => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/`
      }
    });

    if (error) {
      toast({
        title: "Social login failed",
        description: error.message,
        variant: "destructive",
      });
    }

    return { error };
  };

  return (
    <AuthContext.Provider value={{
      user,
      session,
      loading,
      signUp,
      signIn,
      signOut,
      signInWithProvider
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}