import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus } from 'lucide-react';
import { useMatches } from '@/hooks/useMatches';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

const CreateMatchDialog = () => {
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({
    course_name: '',
    location: '',
    scheduled_time: '',
    format: '',
    buy_in_amount: '',
    handicap_min: '',
    handicap_max: '',
    max_participants: '4'
  });

  const { createMatch } = useMatches();
  const { user } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      toast.error('Please sign in to create a match');
      return;
    }

    const matchData = {
      course_name: formData.course_name,
      location: formData.location,
      scheduled_time: formData.scheduled_time,
      format: formData.format,
      buy_in_amount: parseInt(formData.buy_in_amount) * 100, // Convert to cents
      handicap_min: formData.handicap_min ? parseInt(formData.handicap_min) : undefined,
      handicap_max: formData.handicap_max ? parseInt(formData.handicap_max) : undefined,
      max_participants: parseInt(formData.max_participants)
    };

    const { error } = await createMatch(matchData);
    
    if (!error) {
      setOpen(false);
      setFormData({
        course_name: '',
        location: '',
        scheduled_time: '',
        format: '',
        buy_in_amount: '',
        handicap_min: '',
        handicap_max: '',
        max_participants: '4'
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button 
          className="bg-gradient-primary text-primary-foreground hover:shadow-premium"
          onClick={(e) => {
            if (!user) {
              e.preventDefault();
              toast.error('Please sign in to create matches');
            }
          }}
        >
          <Plus className="w-4 h-4 mr-2" />
          {user ? 'Create Match' : 'Sign In to Create Match'}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create New Match</DialogTitle>
          <DialogDescription>
            Set up a new golf match and invite others to join.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="course_name">Golf Course</Label>
            <Input
              id="course_name"
              value={formData.course_name}
              onChange={(e) => setFormData({ ...formData, course_name: e.target.value })}
              placeholder="e.g., Pebble Beach Golf Links"
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="location">Location</Label>
            <Input
              id="location"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              placeholder="e.g., Monterey, CA"
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="scheduled_time">Date & Time</Label>
            <Input
              id="scheduled_time"
              type="datetime-local"
              value={formData.scheduled_time}
              onChange={(e) => setFormData({ ...formData, scheduled_time: e.target.value })}
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="format">Match Format</Label>
            <Select value={formData.format} onValueChange={(value) => setFormData({ ...formData, format: value })}>
              <SelectTrigger>
                <SelectValue placeholder="Select format" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="stroke-play">Stroke Play</SelectItem>
                <SelectItem value="match-play">Match Play</SelectItem>
                <SelectItem value="best-ball">2v2 Best Ball</SelectItem>
                <SelectItem value="skins">Skins Game</SelectItem>
                <SelectItem value="scramble">Scramble</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="buy_in_amount">Buy-in Amount ($)</Label>
            <Input
              id="buy_in_amount"
              type="number"
              min="0"
              value={formData.buy_in_amount}
              onChange={(e) => setFormData({ ...formData, buy_in_amount: e.target.value })}
              placeholder="50"
              required
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="handicap_min">Min Handicap</Label>
              <Input
                id="handicap_min"
                type="number"
                min="0"
                max="54"
                value={formData.handicap_min}
                onChange={(e) => setFormData({ ...formData, handicap_min: e.target.value })}
                placeholder="0"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="handicap_max">Max Handicap</Label>
              <Input
                id="handicap_max"
                type="number"
                min="0"
                max="54"
                value={formData.handicap_max}
                onChange={(e) => setFormData({ ...formData, handicap_max: e.target.value })}
                placeholder="20"
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="max_participants">Max Participants</Label>
            <Select value={formData.max_participants} onValueChange={(value) => setFormData({ ...formData, max_participants: value })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="2">2 Players</SelectItem>
                <SelectItem value="3">3 Players</SelectItem>
                <SelectItem value="4">4 Players</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex justify-end space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" className="bg-gradient-primary text-primary-foreground">
              Create Match
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CreateMatchDialog;