import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useActiveMatch } from '@/hooks/useActiveMatch';
import { ProfileDisplay } from '@/components/profile/ProfileDisplay';
import { ProfileForm } from '@/components/profile/ProfileForm';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, User, Settings, CreditCard, Target, Shield } from 'lucide-react';
import SubscriptionManagement from '@/components/SubscriptionManagement';
import { MFASettings } from '@/components/profile/MFASettings';

export default function Profile() {
  const { user, loading } = useAuth();
  const { hasActiveMatch } = useActiveMatch();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth', { replace: true });
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-subtle">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-subtle">
      {/* Header */}
      <div className="bg-background/80 backdrop-blur-sm border-b border-border/50 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/')}
              className="text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Home
            </Button>
            
            {hasActiveMatch && (
              <Button
                variant="default"
                size="sm"
                onClick={() => navigate('/')}
                className="bg-gradient-primary text-primary-foreground hover:opacity-90 gap-2"
              >
                <Target className="h-4 w-4" />
                <span className="hidden sm:inline">Return to Active Match</span>
                <span className="sm:hidden">Active Match</span>
              </Button>
            )}
            
            <div className="flex-1">
              <h1 className="text-2xl font-bold">Profile Settings</h1>
              <p className="text-muted-foreground">Manage your MatchPlay profile and preferences</p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 py-8">
        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="profile" className="gap-2">
              <User className="w-4 h-4" />
              Profile
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-2">
              <Settings className="w-4 h-4" />
              Settings
            </TabsTrigger>
            <TabsTrigger value="security" className="gap-2">
              <Shield className="w-4 h-4" />
              Security
            </TabsTrigger>
            <TabsTrigger value="subscription" className="gap-2">
              <CreditCard className="w-4 h-4" />
              Subscription
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profile">
            <ProfileDisplay />
          </TabsContent>

          <TabsContent value="settings">
            <ProfileForm />
          </TabsContent>

          <TabsContent value="security">
            <MFASettings />
          </TabsContent>

          <TabsContent value="subscription">
            <SubscriptionManagement />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}