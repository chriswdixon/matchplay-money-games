import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { useProfile } from '@/hooks/useProfile';
import { usePrivateProfile } from '@/hooks/usePrivateProfile';
import { useAuth } from '@/hooks/useAuth';
import { useSubscription } from '@/hooks/useSubscription';
import { useIsMobile } from '@/hooks/use-mobile';
import { User, Phone, Trophy, Calendar, Mail, Star, Crown, Zap, Calculator, X } from 'lucide-react';
import StarRating from '@/components/StarRating';
import { HandicapCalculators } from '@/components/HandicapCalculators';
import { AvatarUpload } from '@/components/profile/AvatarUpload';

export function ProfileDisplay() {
  const { profile, loading, updateProfile } = useProfile();
  const { privateData, loading: privateLoading } = usePrivateProfile();
  const { user } = useAuth();
  const { tierName, loading: subscriptionLoading } = useSubscription();
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const [calcOpen, setCalcOpen] = useState(false);

  const openCalculators = () => {
    if (isMobile) setCalcOpen(true);
    else navigate('/handicap-calculators');
  };

  if (loading || privateLoading || subscriptionLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-muted rounded-full"></div>
              <div className="space-y-2">
                <div className="h-4 bg-muted rounded w-32"></div>
                <div className="h-3 bg-muted rounded w-24"></div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const getMembershipColor = (tier: string | null | undefined) => {
    switch (tier) {
      case 'Tournament Pro': return 'bg-yellow-500 text-white';
      case 'Local Player': return 'bg-gradient-primary text-primary-foreground';
      case 'Free': return 'bg-secondary text-secondary-foreground';
      default: return 'bg-secondary text-secondary-foreground';
    }
  };

  const getMembershipIcon = (tier: string | null | undefined) => {
    switch (tier) {
      case 'Tournament Pro': return <Crown className="w-3 h-3" />;
      case 'Local Player': return <Star className="w-3 h-3" />;
      case 'Free': return <Zap className="w-3 h-3" />;
      default: return <Zap className="w-3 h-3" />;
    }
  };

  return (
    <Card className="shadow-card">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-3">
          <div className="p-2 bg-gradient-primary rounded-lg">
            <User className="w-5 h-5 text-primary-foreground" />
          </div>
          Profile Overview
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Profile Header */}
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4">
          <AvatarUpload
            currentImageUrl={profile?.profile_picture_url || undefined}
            onImageUpdate={(imageUrl) =>
              updateProfile({ profile_picture_url: imageUrl })
            }
          />
          <div className="flex-1 text-center sm:text-left">
            <h3 className="text-xl font-semibold">
              {profile?.display_name || 'Anonymous Golfer'}
            </h3>
            <div className="flex items-center justify-center sm:justify-start gap-2 mt-1">
              <Mail className="w-4 h-4 text-muted-foreground" />
              <span className="text-muted-foreground">{user?.email}</span>
            </div>
            <div className="mt-2">
              <Badge className={`${getMembershipColor(tierName)} inline-flex items-center gap-1 text-xs px-2 py-0.5`}>
                {getMembershipIcon(tierName)}
                {tierName || 'Free'}
              </Badge>
            </div>
          </div>
        </div>

        {/* Featured Handicap card */}
        <div className="rounded-2xl bg-foreground text-background p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
            <Trophy className="w-6 h-6 text-primary" aria-hidden="true" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs uppercase tracking-wide text-background/70">Handicap</div>
            <div className="text-3xl font-bold leading-tight">
              {profile?.handicap !== null && profile?.handicap !== undefined ? profile.handicap : '—'}
            </div>
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={openCalculators}
            className="gap-2 shrink-0"
            aria-label="Open handicap calculators"
          >
            <Calculator className="w-4 h-4" aria-hidden="true" />
            <span className="hidden sm:inline">Calculators</span>
          </Button>
        </div>

        {/* Profile Details */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {privateData?.phone && (
            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
              <Phone className="w-4 h-4 text-muted-foreground" />
              <div>
                <div className="text-sm font-medium">Phone</div>
                <div className="text-sm text-muted-foreground">{privateData.phone}</div>
              </div>
            </div>
          )}

          <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
            <Star className="w-4 h-4 text-muted-foreground" />
            <div>
              <div className="text-sm font-medium">Player Rating</div>
              <div className="flex items-center gap-2">
                <StarRating 
                  rating={profile?.average_rating ? Number(profile.average_rating) : 0} 
                  size="sm" 
                  className="justify-start" 
                />
                {!profile?.average_rating && (
                  <span className="text-xs text-muted-foreground">No ratings yet</span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <div>
              <div className="text-sm font-medium">Member Since</div>
              <div className="text-sm text-muted-foreground">
                {profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : 'Unknown'}
              </div>
            </div>
          </div>
        </div>

        {/* Empty State for Missing Info */}
        {(!profile?.display_name && !privateData?.phone && (profile?.handicap === null || profile?.handicap === undefined)) && (
          <div className="text-center py-8 text-muted-foreground">
            <User className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>Complete your profile to <p>Complete your profile to get the most out of Tyche</p></p>
          </div>
        )}
      </CardContent>

      {/* Mobile: handicap calculators in a popup */}
      <Dialog open={calcOpen} onOpenChange={setCalcOpen}>
        <DialogContent className="w-screen h-[100dvh] max-w-none rounded-none p-0 gap-0 overflow-hidden">
          <DialogTitle className="sr-only">Handicap Calculators</DialogTitle>
          <button
            type="button"
            onClick={() => setCalcOpen(false)}
            aria-label="Close"
            className="absolute top-3 right-3 z-50 inline-flex h-9 w-9 items-center justify-center rounded-full bg-card text-foreground shadow-lg hover:bg-accent transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
          <div className="h-[100dvh] overflow-y-auto pt-12">
            <HandicapCalculators />
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
