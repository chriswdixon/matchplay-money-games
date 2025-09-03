import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Plus, MapPin, Loader2, Check, ChevronsUpDown, Clock } from 'lucide-react';
import { useMatches } from '@/hooks/useMatches';
import { useAuth } from '@/hooks/useAuth';
import { useLocation } from '@/hooks/useLocation';
import { useGolfCourses } from '@/hooks/useGolfCourses';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

const CreateMatchDialog = () => {
  const [open, setOpen] = useState(false);
  const [courseOpen, setCourseOpen] = useState(false);
  const [formData, setFormData] = useState({
    course_name: '',
    scheduled_time: '',
    format: '',
    buy_in_amount: '',
    handicap_min: '',
    handicap_max: '',
    max_participants: '4'
  });
  const [locationCoords, setLocationCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [selectedCourse, setSelectedCourse] = useState<any>(null);

  const { createMatch } = useMatches();
  const { user } = useAuth();
  const { getCurrentLocation, geocodeAddress, loading: locationLoading } = useLocation();
  const { courses, loading: coursesLoading, searchNearbyCourses, formatDistance } = useGolfCourses();

  // Search for nearby courses when location is available
  useEffect(() => {
    if (locationCoords && courses.length === 0) {
      searchNearbyCourses(locationCoords.latitude, locationCoords.longitude);
    }
  }, [locationCoords, courses.length, searchNearbyCourses]);

  const handleGetCurrentLocation = async () => {
    try {
      const location = await getCurrentLocation();
      setLocationCoords(location);
      // Search for nearby courses when location is captured
      searchNearbyCourses(location.latitude, location.longitude);
      toast.success('Current location captured');
    } catch (error) {
      // Error is already handled by useLocation hook
    }
  };

  const handleCourseSelect = (course: any) => {
    setSelectedCourse(course);
    setFormData({ 
      ...formData, 
      course_name: course.name
    });
    setLocationCoords({
      latitude: course.latitude,
      longitude: course.longitude
    });
    setCourseOpen(false);
  };

  const handleCustomCourse = (courseName: string) => {
    setFormData({ ...formData, course_name: courseName });
    setSelectedCourse(null);
  };


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      toast.error('Please sign in to create a match');
      return;
    }

    const matchData = {
      course_name: formData.course_name,
      location: selectedCourse?.address?.split(',').slice(-2).join(',').trim() || formData.course_name,
      address: selectedCourse?.address || undefined,
      latitude: locationCoords?.latitude,
      longitude: locationCoords?.longitude,
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
        scheduled_time: '',
        format: '',
        buy_in_amount: '',
        handicap_min: '',
        handicap_max: '',
        max_participants: '4'
      });
      setLocationCoords(null);
      setSelectedCourse(null);
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
            <Popover open={courseOpen} onOpenChange={setCourseOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={courseOpen}
                  className="w-full justify-between bg-background"
                >
                  {selectedCourse ? (
                    <div className="flex flex-col items-start text-left">
                      <span className="font-medium">{selectedCourse.name}</span>
                      {selectedCourse.distance && (
                        <span className="text-xs text-muted-foreground">
                          {formatDistance(selectedCourse.distance)} away
                        </span>
                      )}
                    </div>
                  ) : formData.course_name ? (
                    formData.course_name
                  ) : (
                    "Select a golf course..."
                  )}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] max-w-none p-0 bg-background border shadow-lg z-[100] pointer-events-auto" align="start">
                <Command className="bg-background border-0">
                  <CommandInput 
                    placeholder="Search golf courses..." 
                    onValueChange={handleCustomCourse}
                    className="border-0 bg-background"
                  />
                  <CommandEmpty className="py-6 text-center">
                    {coursesLoading ? (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        <span className="text-muted-foreground">Loading nearby courses...</span>
                      </div>
                    ) : (
                      <div className="py-4 text-center space-y-2">
                        <p className="text-sm text-muted-foreground mb-2">No courses found</p>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleGetCurrentLocation}
                          disabled={locationLoading}
                          className="mx-auto"
                        >
                          <MapPin className="w-4 h-4 mr-2" />
                          Find nearby courses
                        </Button>
                      </div>
                    )}
                  </CommandEmpty>
                  <CommandGroup className="max-h-60 overflow-auto p-1">
                    {courses.map((course) => (
                      <CommandItem
                        key={`${course.name}-${course.latitude}-${course.longitude}`}
                        className="cursor-pointer rounded-sm px-2 py-3 text-sm outline-none aria-selected:bg-accent aria-selected:text-accent-foreground hover:bg-accent/50 pointer-events-auto"
                        onSelect={(value) => {
                          console.log('Course selected:', course.name);
                          handleCourseSelect(course);
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4 flex-shrink-0",
                            selectedCourse?.name === course.name ? "opacity-100" : "opacity-0"
                          )}
                        />
                        <div className="flex flex-col flex-1 gap-1 overflow-hidden">
                          <span className="font-medium truncate">{course.name}</span>
                          <span className="text-xs text-muted-foreground truncate">
                            {course.address}
                            {course.distance && ` • ${formatDistance(course.distance)}`}
                          </span>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </Command>
              </PopoverContent>
            </Popover>
            {!locationCoords && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleGetCurrentLocation}
                disabled={locationLoading}
                className="w-full"
              >
                {locationLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <MapPin className="w-4 h-4 mr-2" />
                )}
                Find courses near me
              </Button>
            )}
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="scheduled_time">Date & Time</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !formData.scheduled_time && "text-muted-foreground"
                  )}
                >
                  <Clock className="mr-2 h-4 w-4" />
                  {formData.scheduled_time ? (
                    format(new Date(formData.scheduled_time), "PPP 'at' p")
                  ) : (
                    <span>Pick date and time</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 bg-background border shadow-lg z-[100] pointer-events-auto" align="start">
                <div className="p-4 space-y-4">
                  <div>
                    <Label className="text-sm font-medium mb-2 block">Date</Label>
                    <Calendar
                      mode="single"
                      selected={formData.scheduled_time ? new Date(formData.scheduled_time) : undefined}
                      onSelect={(date) => {
                        if (date) {
                          const currentTime = formData.scheduled_time ? new Date(formData.scheduled_time) : new Date();
                          const newDateTime = new Date(date);
                          newDateTime.setHours(currentTime.getHours(), currentTime.getMinutes());
                          setFormData({ ...formData, scheduled_time: newDateTime.toISOString().slice(0, 16) });
                        }
                      }}
                      disabled={(date) => date < new Date()}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-medium mb-2 block">Time</Label>
                    <Input
                      type="time"
                      value={formData.scheduled_time ? new Date(formData.scheduled_time).toTimeString().slice(0, 5) : ''}
                      onChange={(e) => {
                        const currentDate = formData.scheduled_time ? new Date(formData.scheduled_time) : new Date();
                        const [hours, minutes] = e.target.value.split(':');
                        currentDate.setHours(parseInt(hours), parseInt(minutes));
                        setFormData({ ...formData, scheduled_time: currentDate.toISOString().slice(0, 16) });
                      }}
                      className="w-full"
                    />
                  </div>
                </div>
              </PopoverContent>
            </Popover>
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