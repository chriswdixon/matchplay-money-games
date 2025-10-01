import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { useProfile } from '@/hooks/useProfile';
import { usePrivateProfile } from '@/hooks/usePrivateProfile';
import { useAuth } from '@/hooks/useAuth';
import { User, Phone, Trophy, Calendar, Mail, Star } from 'lucide-react';
import StarRating from '@/components/StarRating';

export function ProfileDisplay() {
  const { profile, loading } = useProfile();
  const { privateData, loading: privateLoading } = usePrivateProfile();
  const { user } = useAuth();

  if (loading || privateLoading) {
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
      case 'pro': return 'bg-gradient-accent text-accent-foreground';
      case 'premium': return 'bg-gradient-primary text-primary-foreground';
      case 'tournament': return 'bg-destructive text-destructive-foreground';
      default: return 'bg-secondary text-secondary-foreground';
    }
  };

  const getMembershipLabel = (tier: string | null | undefined) => {
    switch (tier) {
      case 'pro': return 'Pro Member';
      case 'premium': return 'Premium Member';
      case 'tournament': return 'Tournament Player';
      default: return 'Local Player';
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
        <div className="flex items-start gap-4">
          <Avatar className="w-16 h-16 border-2 border-border">
            <AvatarImage src={profile?.profile_picture_url || undefined} alt="Profile picture" />
            <AvatarFallback className="bg-gradient-primary text-primary-foreground text-lg">
              {profile?.display_name?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || '?'}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <h3 className="text-xl font-semibold">
              {profile?.display_name || 'Anonymous Golfer'}
            </h3>
            <div className="flex items-center gap-2 mt-1">
              <Mail className="w-4 h-4 text-muted-foreground" />
              <span className="text-muted-foreground">{user?.email}</span>
            </div>
            <div className="mt-2">
              <Badge className={getMembershipColor(privateData?.membership_tier)}>
                {getMembershipLabel(privateData?.membership_tier)}
              </Badge>
            </div>
          </div>
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

          {profile?.handicap !== null && profile?.handicap !== undefined && (
            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
              <Trophy className="w-4 h-4 text-muted-foreground" />
              <div>
                <div className="text-sm font-medium">Handicap</div>
                <div className="text-sm text-muted-foreground">{profile.handicap}</div>
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
            <p>Complete your profile to get the most out of MatchPlay</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}