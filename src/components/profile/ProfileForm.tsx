import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useProfile } from '@/hooks/useProfile';
import { Save, User } from 'lucide-react';
import type { Tables } from '@/integrations/supabase/types';

type Profile = Tables<'profiles'>;

export function ProfileForm() {
  const { profile, loading, updateProfile } = useProfile();
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    display_name: profile?.display_name || '',
    phone: profile?.phone || '',
    handicap: profile?.handicap?.toString() || '',
    membership_tier: profile?.membership_tier || 'local',
  });

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    const updates: Partial<Profile> = {
      display_name: formData.display_name || null,
      phone: formData.phone || null,
      handicap: formData.handicap ? parseFloat(formData.handicap) : null,
      membership_tier: formData.membership_tier,
    };

    await updateProfile(updates);
    setSaving(false);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-muted rounded w-1/4"></div>
            <div className="h-10 bg-muted rounded"></div>
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
            <User className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <CardTitle>Profile Information</CardTitle>
            <CardDescription>
              Update your profile details and golf information
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="display_name">Display Name</Label>
              <Input
                id="display_name"
                type="text"
                placeholder="Your golf name"
                value={formData.display_name}
                onChange={(e) => handleInputChange('display_name', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="+1 (555) 123-4567"
                value={formData.phone}
                onChange={(e) => handleInputChange('phone', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="handicap">Golf Handicap</Label>
              <Input
                id="handicap"
                type="number"
                step="0.1"
                min="-10"
                max="54"
                placeholder="e.g., 12.5"
                value={formData.handicap}
                onChange={(e) => handleInputChange('handicap', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="membership_tier">Membership Tier</Label>
              <Select
                value={formData.membership_tier}
                onValueChange={(value) => handleInputChange('membership_tier', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select membership tier" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="local">Local Player</SelectItem>
                  <SelectItem value="premium">Premium Member</SelectItem>
                  <SelectItem value="pro">Pro Member</SelectItem>
                  <SelectItem value="tournament">Tournament Player</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex justify-end pt-4">
            <Button 
              type="submit" 
              disabled={saving}
              className="bg-gradient-primary text-primary-foreground shadow-premium hover:shadow-accent transition-smooth"
            >
              <Save className="w-4 h-4 mr-2" />
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}