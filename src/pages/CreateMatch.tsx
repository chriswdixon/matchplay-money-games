import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { ArrowLeft, Loader2, Check, ChevronsUpDown, Clock, MapPin, ExternalLink } from 'lucide-react';
import { useMatches } from '@/hooks/useMatches';
import { useAuth } from '@/hooks/useAuth';
import { useSubscription } from '@/hooks/useSubscription';
import { useLocation } from '@/hooks/useLocation';
import { useGolfCourses } from '@/hooks/useGolfCourses';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';

const CreateMatch = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { subscribed, tierName } = useSubscription();
  const { createMatch } = useMatches();
  const { geocodeAddress } = useLocation();
  const { courses, loading: coursesLoading, searchNearbyCourses, searchCoursesByName, formatDistance } = useGolfCourses();

  const isPaidSubscription = subscribed && tierName !== 'free';

  const [formData, setFormData] = useState({
    course_name: '',
    scheduled_date: null as Date | null,
    scheduled_time: '07:00',
    format: '',
    tee_selection_mode: 'fixed' as 'fixed' | 'individual',
    default_tees: '',
    buy_in_amount: '50',
    handicap_min: '',
    handicap_max: '',
    max_participants: '4',
    booking_url: ''
  });

  const [courseOpen, setCourseOpen] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState<any>(null);
  const [locationCoords, setLocationCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [zipcode, setZipcode] = useState('');
  const [searchRadius] = useState(30);
  const [loadingZipcode, setLoadingZipcode] = useState(false);
  const [loadingGPS, setLoadingGPS] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleZipcodeSearch = async () => {
    if (!zipcode || zipcode.length < 5) {
      toast.error('Please enter a valid 5-digit zipcode');
      return;
    }

    try {
      setLoadingZipcode(true);
      const coords = await geocodeAddress(zipcode);
      
      if (coords) {
        setLocationCoords(coords);
        await searchNearbyCourses(coords.latitude, coords.longitude, searchRadius);
        toast.success(`Found courses within ${searchRadius} miles`);
      } else {
        toast.error('Could not find location for this zipcode');
      }
    } catch (error) {
      toast.error('Failed to search by zipcode');
    } finally {
      setLoadingZipcode(false);
    }
  };

  const handleGPSSearch = async () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser');
      return;
    }

    try {
      setLoadingGPS(true);
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const coords = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          };
          setLocationCoords(coords);
          await searchNearbyCourses(coords.latitude, coords.longitude, searchRadius);
          toast.success(`Found courses within ${searchRadius} miles`);
          setLoadingGPS(false);
        },
        () => {
          setLoadingGPS(false);
          toast.error('Location access denied. Please enable location permissions.');
        }
      );
    } catch (error) {
      setLoadingGPS(false);
      toast.error('Failed to access GPS');
    }
  };

  const handleCourseSelect = (course: any) => {
    setSelectedCourse(course);
    setFormData({ 
      ...formData, 
      course_name: course.name,
      booking_url: course.website || ''
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
    searchCoursesByName(courseName);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      toast.error('Please sign in to create a match');
      navigate('/auth');
      return;
    }

    if (!formData.course_name) {
      toast.error('Please select a golf course');
      return;
    }

    if (!formData.scheduled_date) {
      toast.error('Please select a date');
      return;
    }

    if (!formData.format) {
      toast.error('Please select a match format');
      return;
    }

    if (formData.tee_selection_mode === 'fixed' && !formData.default_tees) {
      toast.error('Please select tees for all players');
      return;
    }

    try {
      setSubmitting(true);

      // Combine date and time
      const [hours, minutes] = formData.scheduled_time.split(':');
      const scheduledDateTime = new Date(formData.scheduled_date);
      scheduledDateTime.setHours(parseInt(hours), parseInt(minutes));

      const matchData = {
        course_name: formData.course_name,
        location: selectedCourse?.address?.split(',').slice(-2).join(',').trim() || formData.course_name,
        address: selectedCourse?.address || undefined,
        latitude: locationCoords?.latitude,
        longitude: locationCoords?.longitude,
        scheduled_time: scheduledDateTime.toISOString(),
        format: formData.format,
        buy_in_amount: parseInt(formData.buy_in_amount) * 100,
        handicap_min: formData.handicap_min ? parseInt(formData.handicap_min) : undefined,
        handicap_max: formData.handicap_max ? parseInt(formData.handicap_max) : undefined,
        max_participants: parseInt(formData.max_participants),
        booking_url: formData.booking_url || undefined,
        tee_selection_mode: formData.tee_selection_mode,
        default_tees: formData.tee_selection_mode === 'fixed' ? formData.default_tees : undefined
      };

      const { error } = await createMatch(matchData, locationCoords || undefined);
      
      if (!error) {
        navigate('/');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const isFormValid = formData.course_name && formData.scheduled_date && formData.format && 
    (formData.tee_selection_mode === 'individual' || formData.default_tees);

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background border-b">
        <div className="container mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold">Create Match</h1>
        </div>
      </header>

      {/* Form */}
      <form onSubmit={handleSubmit} className="container mx-auto px-4 py-6 space-y-6 max-w-2xl">
        {/* Golf Course */}
        <div className="space-y-3">
          <Label>Golf Course *</Label>
          
          {isPaidSubscription && (
            <div className="space-y-2">
              <div className="flex gap-2">
                <Input
                  type="tel"
                  placeholder="Enter zipcode"
                  value={zipcode}
                  onChange={(e) => setZipcode(e.target.value.replace(/\D/g, '').slice(0, 5))}
                  maxLength={5}
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleZipcodeSearch}
                  disabled={loadingZipcode || zipcode.length < 5}
                >
                  {loadingZipcode ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Search'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleGPSSearch}
                  disabled={loadingGPS}
                >
                  {loadingGPS ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">Search courses within {searchRadius} miles</p>
            </div>
          )}

          <Popover open={courseOpen} onOpenChange={setCourseOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                className="w-full justify-between"
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
                ) : formData.course_name || "Type or select a course..."}
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
              <Command>
                <CommandInput 
                  placeholder="Search courses..." 
                  onValueChange={handleCustomCourse}
                />
                <ScrollArea className="h-[300px]">
                  <CommandList>
                    <CommandEmpty>
                      {coursesLoading ? (
                        <div className="flex items-center justify-center py-6">
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                          <span>Loading...</span>
                        </div>
                      ) : (
                        <p className="py-6 text-center text-sm">No courses found</p>
                      )}
                    </CommandEmpty>
                    <CommandGroup>
                      {courses.map((course) => (
                        <CommandItem
                          key={`${course.name}-${course.latitude}`}
                          value={course.name}
                          onSelect={() => handleCourseSelect(course)}
                          className="cursor-pointer"
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              selectedCourse?.name === course.name ? "opacity-100" : "opacity-0"
                            )}
                          />
                          <div className="flex-1">
                            <div className="font-medium">{course.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {course.address}
                              {course.distance && ` • ${formatDistance(course.distance)}`}
                            </div>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </ScrollArea>
              </Command>
            </PopoverContent>
          </Popover>
        </div>

        {/* Tee Time Booking */}
        {isPaidSubscription && (
          <div className="space-y-2">
            <Label htmlFor="booking_url">Tee Time Booking (Optional)</Label>
            <div className="flex gap-2">
              <Input
                id="booking_url"
                type="url"
                placeholder="Enter booking URL or leave blank for Google search"
                value={formData.booking_url}
                onChange={(e) => setFormData({ ...formData, booking_url: e.target.value })}
              />
              {formData.course_name && (
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => window.open(`https://www.google.com/search?q=${encodeURIComponent(formData.course_name + ' tee time booking')}`, '_blank')}
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Date & Time */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Date *</Label>
            <Popover open={dateOpen} onOpenChange={setDateOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn("w-full justify-start", !formData.scheduled_date && "text-muted-foreground")}
                >
                  <Clock className="mr-2 h-4 w-4" />
                  {formData.scheduled_date ? format(formData.scheduled_date, "MMM d") : "Pick date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={formData.scheduled_date || undefined}
                  onSelect={(date) => {
                    setFormData({ ...formData, scheduled_date: date || null });
                    setDateOpen(false);
                  }}
                  disabled={(date) => date < new Date()}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label htmlFor="time">Time *</Label>
            <Input
              id="time"
              type="time"
              value={formData.scheduled_time}
              onChange={(e) => setFormData({ ...formData, scheduled_time: e.target.value })}
            />
          </div>
        </div>

        {/* Match Format */}
        <div className="space-y-2">
          <Label>Match Format *</Label>
          <RadioGroup value={formData.format} onValueChange={(value) => setFormData({ ...formData, format: value })}>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="stroke-play" id="stroke-play" />
              <Label htmlFor="stroke-play" className="font-normal cursor-pointer">Stroke Play</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="match-play" id="match-play" />
              <Label htmlFor="match-play" className="font-normal cursor-pointer">Match Play</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="best-ball" id="best-ball" />
              <Label htmlFor="best-ball" className="font-normal cursor-pointer">Best Ball</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="skins-game" id="skins-game" />
              <Label htmlFor="skins-game" className="font-normal cursor-pointer">Skins Game</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="scramble" id="scramble" />
              <Label htmlFor="scramble" className="font-normal cursor-pointer">Scramble</Label>
            </div>
          </RadioGroup>
        </div>

        {/* Tee Selection */}
        <div className="space-y-3">
          <Label>Tee Selection *</Label>
          <RadioGroup 
            value={formData.tee_selection_mode} 
            onValueChange={(value) => setFormData({ ...formData, tee_selection_mode: value as 'fixed' | 'individual', default_tees: '' })}
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="fixed" id="fixed-tees" />
              <Label htmlFor="fixed-tees" className="font-normal cursor-pointer">Everyone plays same tees</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="individual" id="individual-tees" />
              <Label htmlFor="individual-tees" className="font-normal cursor-pointer">Each player picks their own</Label>
            </div>
          </RadioGroup>

          {formData.tee_selection_mode === 'fixed' && (
            <Select value={formData.default_tees} onValueChange={(value) => setFormData({ ...formData, default_tees: value })}>
              <SelectTrigger>
                <SelectValue placeholder="Select tees" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="black">Black (Championship)</SelectItem>
                <SelectItem value="blue">Blue (Back)</SelectItem>
                <SelectItem value="white">White (Middle)</SelectItem>
                <SelectItem value="gold">Gold (Senior)</SelectItem>
                <SelectItem value="red">Red (Forward)</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Buy-In Amount */}
        <div className="space-y-2">
          <Label htmlFor="buy_in">Buy-In Amount ($)</Label>
          <Input
            id="buy_in"
            type="number"
            min="0"
            max="500"
            value={formData.buy_in_amount}
            onChange={(e) => setFormData({ ...formData, buy_in_amount: e.target.value })}
          />
          <p className="text-xs text-muted-foreground">Default: $50 • Max: $500</p>
        </div>

        {/* Handicap Range */}
        <div className="space-y-2">
          <Label>Handicap Range (Optional)</Label>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Input
                type="number"
                placeholder="Min"
                value={formData.handicap_min}
                onChange={(e) => setFormData({ ...formData, handicap_min: e.target.value })}
              />
            </div>
            <div>
              <Input
                type="number"
                placeholder="Max"
                value={formData.handicap_max}
                onChange={(e) => setFormData({ ...formData, handicap_max: e.target.value })}
              />
            </div>
          </div>
        </div>

        {/* Max Players */}
        <div className="space-y-2">
          <Label htmlFor="max_players">Max Players</Label>
          <Select value={formData.max_participants} onValueChange={(value) => setFormData({ ...formData, max_participants: value })}>
            <SelectTrigger id="max_players">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">1 (Testing)</SelectItem>
              <SelectItem value="2">2</SelectItem>
              <SelectItem value="3">3</SelectItem>
              <SelectItem value="4">4 (Default)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Submit Button */}
        <div className="pt-6">
          <Button type="submit" className="w-full" disabled={!isFormValid || submitting}>
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating Match...
              </>
            ) : (
              'Create Match'
            )}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default CreateMatch;
