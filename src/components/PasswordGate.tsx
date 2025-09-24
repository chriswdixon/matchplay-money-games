import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface PasswordGateProps {
  children: React.ReactNode;
}

const PasswordGate = ({ children }: PasswordGateProps) => {
  const [password, setPassword] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  // Check if already authenticated on mount
  useEffect(() => {
    const sessionToken = localStorage.getItem("site_session_token");
    const isAuth = sessionToken && localStorage.getItem("site_authenticated") === "true";
    setIsAuthenticated(!!isAuth);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Get client IP for rate limiting (this is a best effort, may not always work)
      const clientIP = await fetch('https://api.ipify.org?format=json')
        .then(res => res.json())
        .then(data => data.ip)
        .catch(() => null);

      const { data, error } = await supabase.functions.invoke('validate-site-password', {
        body: { 
          password: password.trim(),
          clientIP 
        }
      });

      if (error) {
        throw error;
      }

      if (data.success) {
        localStorage.setItem("site_authenticated", "true");
        localStorage.setItem("site_session_token", data.sessionToken);
        setIsAuthenticated(true);
        toast({
          title: "Access granted",
          description: "Welcome to MatchPlay!",
        });
      } else {
        const errorMessage = data.rateLimited 
          ? "Too many attempts. Please try again later."
          : data.error || "Invalid password";
        
        toast({
          title: "Access denied",
          description: errorMessage,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Authentication error:', error);
      toast({
        title: "Error",
        description: "Unable to verify password. Please try again.",
        variant: "destructive",
      });
    }
    
    setLoading(false);
    setPassword("");
  };

  if (isAuthenticated) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-gradient-hero flex items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-12 h-12 bg-primary rounded-full flex items-center justify-center">
            <Lock className="w-6 h-6 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl">Site Access Required</CardTitle>
          <CardDescription>
            Please enter the password to access MatchPlay
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter site password"
                required
                disabled={loading}
              />
            </div>
            <Button 
              type="submit" 
              className="w-full" 
              disabled={loading || !password.trim()}
            >
              {loading ? "Checking..." : "Access Site"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default PasswordGate;