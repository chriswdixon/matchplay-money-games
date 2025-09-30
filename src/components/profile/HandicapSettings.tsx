import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useProfile } from '@/hooks/useProfile';
import { Trophy } from 'lucide-react';
import { toast } from 'sonner';

export function HandicapSettings() {
  const { profile, loading, updateProfile } = useProfile();
  const [handicap, setHandicap] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
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
