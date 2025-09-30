import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { ProfileDisplay } from '@/components/profile/ProfileDisplay';
import { ProfileForm } from '@/components/profile/ProfileForm';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useProfile } from '@/hooks/useProfile';
import { ArrowLeft, User, Settings, Trophy, CreditCard } from 'lucide-react';
import { useState, useEffect as useEffectLocal } from 'react';
import { toast } from 'sonner';
import SubscriptionManagement from '@/components/SubscriptionManagement';

export default function Profile() {
  const { user, loading } = useAuth();
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
            <TabsTrigger value="handicap" className="gap-2">
              <Trophy className="w-4 h-4" />
              Handicap
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

          <TabsContent value="handicap">
            <HandicapSettings />
          </TabsContent>

          <TabsContent value="subscription">
            <SubscriptionManagement />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function HandicapSettings() {
  const { profile, loading, updateProfile } = useProfile();
  const [handicap, setHandicap] = useState('');
  const [saving, setSaving] = useState(false);

  useEffectLocal(() => {
    if (profile) {
      setHandicap(profile.handicap?.toString() || '');
    }
  }, [profile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      await updateProfile({
        handicap: handicap ? parseFloat(handicap) : null,
      });
      toast.success('Handicap updated successfully');
    } catch (error) {
      console.error('Error updating handicap:', error);
      toast.error('Failed to update handicap');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-muted rounded w-1/4"></div>
            <div className="h-10 bg-muted rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-card">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-primary rounded-lg">
            <Trophy className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <CardTitle>Golf Handicap</CardTitle>
            <CardDescription>
              Update your official golf handicap index
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="handicap">Handicap Index</Label>
            <Input
              id="handicap"
              type="number"
              step="0.1"
              min="-10"
              max="54"
              placeholder="e.g., 12.5"
              value={handicap}
              onChange={(e) => setHandicap(e.target.value)}
            />
            <p className="text-sm text-muted-foreground">
              Enter your official USGA Handicap Index (range: -10 to 54)
            </p>
          </div>

          <div className="flex justify-end pt-4">
            <Button 
              type="submit" 
              disabled={saving}
              className="bg-gradient-primary text-primary-foreground shadow-premium hover:shadow-accent transition-smooth"
            >
              {saving ? "Saving..." : "Save Handicap"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}