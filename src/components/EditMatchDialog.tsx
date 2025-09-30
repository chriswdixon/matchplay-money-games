import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Edit, MapPin, Loader2, Check, ChevronsUpDown, Clock, X } from 'lucide-react';
import { useMatches } from '@/hooks/useMatches';
import { useAuth } from '@/hooks/useAuth';
import { useLocation } from '@/hooks/useLocation';
import { useGolfCourses } from '@/hooks/useGolfCourses';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface EditMatchDialogProps {
  match: any;
  onMatchUpdated?: () => void;
}

const EditMatchDialog = ({ match, onMatchUpdated }: EditMatchDialogProps) => {
  const [open, setOpen] = useState(false);
  const [courseOpen, setCourseOpen] = useState(false);
  const [dateTimeOpen, setDateTimeOpen] = useState(false);
  const [formData, setFormData] = useState({
    course_name: '',
    scheduled_time: '',
    format: '',
    buy_in_amount: '',
    handicap_min: '',
    handicap_max: '',
    max_participants: '',
    booking_url: '',
    tee_selection_mode: 'fixed' as 'fixed' | 'individual',
    default_tees: ''
  });
  const [locationCoords, setLocationCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [selectedCourse, setSelectedCourse] = useState<any>(null);
  const [timeManuallySet, setTimeManuallySet] = useState(false);
  const [hourDisplay, setHourDisplay] = useState('');
  const [zipcode, setZipcode] = useState('');
  const [loadingZipcode, setLoadingZipcode] = useState(false);
  const [searchRadius, setSearchRadius] = useState<number>(30);

  const { updateMatch } = useMatches();
  const { user } = useAuth();
  const { getCurrentLocation, geocodeAddress, loading: locationLoading } = useLocation();
  const { courses, loading: coursesLoading, searchNearbyCourses, searchCoursesByName, formatDistance } = useGolfCourses();

  // Initialize form data when match prop changes
  useEffect(() => {
    if (match) {
      setFormData({
        course_name: match.course_name || '',
        scheduled_time: match.scheduled_time ? new Date(match.scheduled_time).toISOString().slice(0, 16) : '',
        format: match.format || '',
        buy_in_amount: String(match.buy_in_amount / 100) || '50',
        handicap_min: match.handicap_min ? String(match.handicap_min) : '',
        handicap_max: match.handicap_max ? String(match.handicap_max) : '',
        max_participants: String(match.max_participants) || '4',
        booking_url: match.booking_url || '',
        tee_selection_mode: match.tee_selection_mode || 'fixed',
        default_tees: match.default_tees || ''
      });
      
      if (match.latitude && match.longitude) {
        setLocationCoords({
          latitude: parseFloat(match.latitude),
          longitude: parseFloat(match.longitude)
        });
      }
    }
  }, [match]);

  // Search for nearby courses when location is available
  useEffect(() => {
    if (locationCoords && courses.length === 0) {
      searchNearbyCourses(locationCoords.latitude, locationCoords.longitude, searchRadius);
    }
  }, [locationCoords, courses.length, searchNearbyCourses, searchRadius]);

  // Set hour display when scheduled time changes
  useEffect(() => {
    if (formData.scheduled_time && !timeManuallySet) {
      const time = new Date(formData.scheduled_time);
      const hours = time.getHours();
      const displayHour = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
      const period = hours >= 12 ? 'PM' : 'AM';
      setHourDisplay(`${displayHour}:${time.getMinutes().toString().padStart(2, '0')} ${period}`);
    }
  }, [formData.scheduled_time, timeManuallySet]);

  const formatOptions = [
    { value: 'stroke-play', label: 'Stroke Play' },
    { value: 'match-play', label: 'Match Play' },
    { value: 'best-ball', label: '2v2 Best Ball' },
    { value: 'skins', label: 'Skins Game' },
    { value: 'scramble', label: 'Scramble' }
  ];

  const participantOptions = Array.from({ length: 3 }, (_, i) => ({
    value: String(i + 2),
    label: `${i + 2} players`
  }));

  const isTimeInPast = (datetime: string) => {
    if (!datetime) return false;
    return new Date(datetime) <= new Date();
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleCourseSelect = async (course: any) => {
    if (course.latitude && course.longitude) {
      setLocationCoords({
        latitude: parseFloat(course.latitude),
        longitude: parseFloat(course.longitude)
      });
    } else if (course.address) {
      try {
        const coords = await geocodeAddress(course.address);
        if (coords) {
          setLocationCoords(coords);
        }
      } catch (error) {
        console.error('Error geocoding address:', error);
      }
    }

    setSelectedCourse(course);
    setFormData(prev => ({ 
      ...prev, 
      course_name: course.name,
      booking_url: course.website || `https://www.google.com/search?q=${encodeURIComponent(course.name + ' tee time booking')}`
    }));
    setCourseOpen(false);
  };

  const handleTimeChange = (field: string, value: string) => {
    setTimeManuallySet(true);
    handleInputChange(field, value);
  };

  const searchCourses = async (query: string) => {
    if (query.length >= 2) {
      await searchCoursesByName(query);
    }
  };

  const handleZipcodeSearch = async () => {
    if (!zipcode || zipcode.length < 5) {
      toast.error('Please enter a valid 5-digit zipcode');
      return;
    }

    // Validate zipcode format (US zipcodes only)
    if (!/^\d{5}$/.test(zipcode)) {
      toast.error('Please enter a valid 5-digit zipcode');
      return;
    }

    try {
      setLoadingZipcode(true);
      console.log('🔍 Searching for zipcode:', zipcode);
      const coords = await geocodeAddress(zipcode);
      console.log('📍 Geocode result:', coords);
      
      if (coords) {
        setLocationCoords(coords);
        await searchNearbyCourses(coords.latitude, coords.longitude, searchRadius);
        toast.success(`Location found - searching within ${searchRadius} miles`);
      } else {
        console.error('❌ No coordinates returned for zipcode:', zipcode);
        toast.error('Could not find location for this zipcode. Try a different zipcode.');
      }
    } catch (error) {
      console.error('❌ Zipcode search error:', error);
      toast.error('Failed to search by zipcode. Please try again.');
    } finally {
      setLoadingZipcode(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      toast.error('You must be logged in to edit a match');
      return;
    }

    if (isTimeInPast(formData.scheduled_time)) {
      toast.error('Cannot schedule match in the past');
      return;
    }

    try {
      const matchData = {
        course_name: formData.course_name,
        location: selectedCourse?.address || match.location,
        address: selectedCourse?.address || match.address,
        scheduled_time: formData.scheduled_time,
        format: formData.format,
        buy_in_amount: parseInt(formData.buy_in_amount) * 100,
        handicap_min: formData.handicap_min ? parseInt(formData.handicap_min) : null,
        handicap_max: formData.handicap_max ? parseInt(formData.handicap_max) : null,
        max_participants: parseInt(formData.max_participants),
        latitude: locationCoords?.latitude || match.latitude,
        longitude: locationCoords?.longitude || match.longitude,
        booking_url: formData.booking_url || null,
        tee_selection_mode: formData.tee_selection_mode,
        default_tees: formData.tee_selection_mode === 'fixed' ? formData.default_tees : null
      };

      await updateMatch(match.id, matchData);
      setOpen(false);
      onMatchUpdated?.();
      toast.success('Match updated successfully!');
    } catch (error) {
      console.error('Error updating match:', error);
      toast.error('Failed to update match. Please try again.');
    }
  };

  const filteredCourses = useMemo(() => {
    if (!formData.course_name) return courses;
    return courses.filter(course =>
      course.name.toLowerCase().includes(formData.course_name.toLowerCase())
    );
  }, [courses, formData.course_name]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="border-accent text-accent hover:bg-accent hover:text-accent-foreground"
        >
          <Edit className="w-4 h-4 mr-2" />
          Edit Match
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-foreground">Edit Match</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Update your match details. Changes will be visible to all participants.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Golf Course Selection */}
          <div className="space-y-2">
            <Label htmlFor="course" className="text-sm font-medium">Golf Course</Label>
            
            {!locationCoords && (
              <div className="space-y-2 mb-2">
                <div className="flex gap-2">
                  <Input
                    type="text"
                    placeholder="Enter zipcode to find nearby courses"
                    value={zipcode}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, '');
                      setZipcode(value);
                    }}
                    maxLength={5}
                    className="flex-1"
                  />
                  <Select value={String(searchRadius)} onValueChange={(value) => setSearchRadius(Number(value))}>
                    <SelectTrigger className="w-[110px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="15">15 miles</SelectItem>
                      <SelectItem value="30">30 miles</SelectItem>
                      <SelectItem value="50">50 miles</SelectItem>
                      <SelectItem value="100">100 miles</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleZipcodeSearch}
                    disabled={loadingZipcode || !zipcode || zipcode.length < 5}
                  >
                    {loadingZipcode ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      'Search'
                    )}
                  </Button>
                </div>
              </div>
            )}
            
            <Popover open={courseOpen} onOpenChange={setCourseOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={courseOpen}
                  className="w-full justify-between hover:border-primary"
                >
                  <div className="flex items-center">
                    <MapPin className="w-4 h-4 mr-2 text-muted-foreground" />
                    {formData.course_name || "Search golf courses..."}
                  </div>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] max-w-none p-0 border shadow-lg z-[9999]" align="start" sideOffset={5}>
                <Command className="border-0">
                  <CommandInput
                    placeholder="Search courses..."
                    value={formData.course_name}
                    onValueChange={(value) => {
                      handleInputChange('course_name', value);
                      searchCourses(value);
                    }}
                    className="border-0"
                  />
                  <CommandList>
                    <CommandEmpty>
                      {coursesLoading ? (
                        <div className="flex items-center justify-center p-4">
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                          Searching courses...
                        </div>
                      ) : (
                        "No courses found."
                      )}
                    </CommandEmpty>
                    <CommandGroup>
                      {filteredCourses.map((course, index) => (
                        <CommandItem
                          key={course.name + index}
                          value={course.name}
                          onSelect={() => handleCourseSelect(course)}
                          className="cursor-pointer rounded-sm px-2 py-3 text-sm outline-none aria-selected:bg-accent aria-selected:text-accent-foreground hover:bg-accent/50"
                        >
                          <Check className={cn("mr-2 h-4 w-4 flex-shrink-0", selectedCourse?.name === course.name ? "opacity-100" : "opacity-0")} />
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
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Date and Time */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="date" className="text-sm font-medium">Date & Time</Label>
              <Input
                id="datetime"
                type="datetime-local"
                value={formData.scheduled_time}
                onChange={(e) => handleTimeChange('scheduled_time', e.target.value)}
                min={new Date().toISOString().slice(0, 16)}
                className="hover:border-primary focus:border-primary"
                required
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Selected Time</Label>
              <div className="flex items-center h-10 px-3 border border-border rounded-md bg-muted">
                <Clock className="w-4 h-4 mr-2 text-muted-foreground" />
                <span className="text-sm">{hourDisplay || 'No time selected'}</span>
              </div>
            </div>
          </div>

          {/* Match Format */}
          <div className="space-y-2">
            <Label htmlFor="format" className="text-sm font-medium">Match Format</Label>
            <Select value={formData.format} onValueChange={(value) => handleInputChange('format', value)} required>
              <SelectTrigger className="hover:border-primary">
                <SelectValue placeholder="Select match format" />
              </SelectTrigger>
              <SelectContent>
                {formatOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Tee Selection */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Tee Selection</Label>
            <Select 
              value={formData.tee_selection_mode} 
              onValueChange={(value: 'fixed' | 'individual') => handleInputChange('tee_selection_mode', value)}
            >
              <SelectTrigger className="hover:border-primary">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fixed">Creator selects tees for everyone</SelectItem>
                <SelectItem value="individual">Each participant picks their own tees</SelectItem>
              </SelectContent>
            </Select>
            
            {formData.tee_selection_mode === 'fixed' && (
              <div className="space-y-2">
                <Label htmlFor="default_tees" className="text-sm font-medium">Which Tees?</Label>
                <Select 
                  value={formData.default_tees} 
                  onValueChange={(value) => handleInputChange('default_tees', value)}
                >
                  <SelectTrigger className="hover:border-primary">
                    <SelectValue placeholder="Select tees" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Black">Black (Championship)</SelectItem>
                    <SelectItem value="Blue">Blue (Tournament)</SelectItem>
                    <SelectItem value="White">White (Men's)</SelectItem>
                    <SelectItem value="Gold">Gold</SelectItem>
                    <SelectItem value="Red">Red (Forward/Ladies)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            {formData.tee_selection_mode === 'individual' && (
              <p className="text-xs text-muted-foreground">
                Participants will select their preferred tees when they join the match
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="buy_in" className="text-sm font-medium">Buy-in Amount ($)</Label>
              <Input
                id="buy_in"
                type="number"
                min="0"
                max="1000"
                step="5"
                value={formData.buy_in_amount}
                onChange={(e) => handleInputChange('buy_in_amount', e.target.value)}
                className="hover:border-primary focus:border-primary"
                placeholder="50"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="max_participants" className="text-sm font-medium">Max Players</Label>
              <Select value={formData.max_participants} onValueChange={(value) => handleInputChange('max_participants', value)} required>
                <SelectTrigger className="hover:border-primary">
                  <SelectValue placeholder="Select max players" />
                </SelectTrigger>
                <SelectContent>
                  {participantOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Handicap Range */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="handicap_min" className="text-sm font-medium">Min Handicap (optional)</Label>
              <Input
                id="handicap_min"
                type="number"
                min="0"
                max="36"
                value={formData.handicap_min}
                onChange={(e) => handleInputChange('handicap_min', e.target.value)}
                className="hover:border-primary focus:border-primary"
                placeholder="e.g., 10"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="handicap_max" className="text-sm font-medium">Max Handicap (optional)</Label>
              <Input
                id="handicap_max"
                type="number"
                min="0"
                max="36"
                value={formData.handicap_max}
                onChange={(e) => handleInputChange('handicap_max', e.target.value)}
                className="hover:border-primary focus:border-primary"
                placeholder="e.g., 25"
              />
            </div>
          </div>

          {/* Booking URL */}
          <div className="space-y-2">
            <Label htmlFor="booking_url" className="text-sm font-medium">Tee Time Booking URL (Optional)</Label>
            <Input
              id="booking_url"
              type="url"
              value={formData.booking_url}
              onChange={(e) => handleInputChange('booking_url', e.target.value)}
              className="hover:border-primary focus:border-primary"
              placeholder="https://example.com/book-tee-time"
            />
            <p className="text-xs text-muted-foreground">
              Add a link to the course's booking page so participants can reserve their tee time
            </p>
          </div>

          {/* Submit Button */}
          <div className="flex justify-end space-x-4 pt-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              className="px-8"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="px-8 bg-gradient-primary text-primary-foreground hover:shadow-premium transition-all duration-300"
            >
              Update Match
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default EditMatchDialog;