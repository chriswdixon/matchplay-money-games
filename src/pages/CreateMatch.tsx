import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { ArrowLeft, Loader2, Check, ChevronsUpDown, Clock, MapPin, ExternalLink, Star, Lock, Plus, Info, AlertCircle } from 'lucide-react';
import { useMatches } from '@/hooks/useMatches';
import { useAuth } from '@/hooks/useAuth';
import { useSubscription } from '@/hooks/useSubscription';
import { useLocation } from '@/hooks/useLocation';
import { useGolfCourses } from '@/hooks/useGolfCourses';
import { useFavoriteCourses } from '@/hooks/useFavoriteCourses';
import { useIsMobile } from '@/hooks/use-mobile';
import { useFreeTier } from '@/hooks/useFreeTier';
import { useAIGolfCourses } from '@/hooks/useAIGolfCourses';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { CreateCourseDialog } from '@/components/CreateCourseDialog';
import { SmartCourseSearch } from '@/components/SmartCourseSearch';
import { CourseRecommendations } from '@/components/CourseRecommendations';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';

const CreateMatch = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const { subscribed, tierName } = useSubscription();
  const { isFree, hasAccess } = useFreeTier();
  const { createMatch } = useMatches();
  const { geocodeAddress } = useLocation();
  const { courses, loading: coursesLoading, searchNearbyCourses, searchCoursesByName, formatDistance } = useGolfCourses();
  const { favorites, addFavorite, removeFavorite, isFavorite, getFavoriteId } = useFavoriteCourses();
  const { loading: aiLoading, smartSearch } = useAIGolfCourses();

  const isPaidSubscription = subscribed && tierName !== 'free';

  const [currentStep, setCurrentStep] = useState(0);
  const [hasIncompleteMatches, setHasIncompleteMatches] = useState(false);
  const [checkingIncomplete, setCheckingIncomplete] = useState(true);
  const [formData, setFormData] = useState({
    course_name: '',
    scheduled_date: null as Date | null,
    scheduled_time: '07:00',
    format: '',
    default_tees: '',
    holes: '18',
    buy_in_amount: '50',
    handicap_min: '',
    handicap_max: '',
    max_participants: '4',
    booking_url: '',
    pin: ''
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
  const [createCourseOpen, setCreateCourseOpen] = useState(false);
  const [customSearchTerm, setCustomSearchTerm] = useState('');
  
  // Validation state
  const [validationErrors, setValidationErrors] = useState({
    buy_in_amount: '',
    handicap_min: '',
    handicap_max: '',
    handicap_range: ''
  });

  // Check for incomplete matches on mount
  useEffect(() => {
    const checkIncompleteMatches = async () => {
      if (!user) {
        setCheckingIncomplete(false);
        return;
      }

      try {
        // Check if user has any started matches without finalized results
        const { data: participantData, error: participantError } = await supabase
          .from('match_participants')
          .select('match_id')
          .eq('user_id', user.id);

        if (participantError) throw participantError;

        if (participantData && participantData.length > 0) {
          const matchIds = participantData.map(p => p.match_id);

          // Check for started matches without finalized results
          const { data: incompleteData, error: incompleteError } = await supabase
            .from('matches')
            .select('id, match_results!inner(finalized_at)')
            .in('id', matchIds)
            .eq('status', 'started');

          if (incompleteError) throw incompleteError;

          const hasIncomplete = incompleteData?.some((match: any) => {
            const results = match.match_results;
            return !results || (Array.isArray(results) && (results.length === 0 || !results[0]?.finalized_at));
          });

          setHasIncompleteMatches(!!hasIncomplete);
        }
      } catch (error) {
        console.error('Error checking incomplete matches:', error);
      } finally {
        setCheckingIncomplete(false);
      }
    };

    checkIncompleteMatches();
  }, [user]);

  // Load saved form data from localStorage on mount
  useEffect(() => {
    const savedData = localStorage.getItem('matchFormData');
    if (savedData) {
      try {
        const parsed = JSON.parse(savedData);
        // Convert saved date string back to Date object
        if (parsed.scheduled_date) {
          parsed.scheduled_date = new Date(parsed.scheduled_date);
        }
        setFormData(parsed);
        toast.info('Restored your previous match form');
      } catch (error) {
        console.error('Failed to load saved form data:', error);
      }
    }
  }, []);

  // Save form data to localStorage with debouncing to prevent crashes from excessive saves
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      // Only save if there's meaningful data
      if (formData.course_name || formData.format) {
        localStorage.setItem('matchFormData', JSON.stringify(formData));
      }
    }, 500); // Wait 500ms after user stops typing

    return () => clearTimeout(timeoutId);
  }, [formData]);

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
      booking_url: course.website || `https://www.google.com/search?q=${encodeURIComponent(course.name + ' tee time booking')}`
    });
    setLocationCoords({
      latitude: course.latitude,
      longitude: course.longitude
    });
    setCourseOpen(false);
  };

  const handleToggleFavorite = async (e: React.MouseEvent, course: any) => {
    e.stopPropagation();
    
    if (!user) {
      toast.error('Please sign in to favorite courses');
      return;
    }

    const courseName = course.name;
    
    if (isFavorite(courseName)) {
      const favoriteId = getFavoriteId(courseName);
      if (favoriteId) {
        await removeFavorite(favoriteId);
      }
    } else {
      await addFavorite({
        course_name: courseName,
        address: course.address,
        latitude: course.latitude,
        longitude: course.longitude,
      });
    }
  };

  const handleCancel = () => {
    // Clear saved form data
    localStorage.removeItem('matchFormData');
    navigate('/');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
    }
  };

  const canGoNext = () => {
    if (currentStep === 0) return formData.course_name;
    if (currentStep === 1) return formData.scheduled_date && formData.scheduled_time;
    if (currentStep === 2) return formData.format && formData.default_tees;
    return true;
  };

  const handleNext = () => {
    if (canGoNext() && currentStep < 3) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleCustomCourse = (courseName: string) => {
    setCustomSearchTerm(courseName);
    setFormData({ ...formData, course_name: courseName });
    setSelectedCourse(null);
    if (courseName.length >= 2) {
      searchCoursesByName(courseName);
    }
  };

  const handleCourseCreated = (newCourse: any) => {
    const course = {
      name: newCourse.name,
      address: newCourse.address,
      latitude: newCourse.latitude,
      longitude: newCourse.longitude,
      website: newCourse.website,
    };
    handleCourseSelect(course);
    toast.success('Course created and selected!');
  };

  const handleSubmit = async () => {
    // Prevent form submission if not on the final step
    if (currentStep !== 3) {
      return;
    }
    
    if (!user) {
      toast.error('Please sign in to create a match');
      navigate('/auth');
      return;
    }

    if (hasIncompleteMatches) {
      toast.error('Please complete your current match before creating a new one');
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

    if (!formData.default_tees) {
      toast.error('Please select tees');
      return;
    }

    // Validate 9-hole time restriction
    if (formData.holes === '9' && formData.scheduled_time) {
      const [hours] = formData.scheduled_time.split(':').map(Number);
      if (hours < 18) {
        toast.error('9-hole matches can only be scheduled at or after 6:00 PM');
        return;
      }
    }

    try {
      setSubmitting(true);

      // Combine date and time
      const [hours, minutes] = formData.scheduled_time.split(':');
      const scheduledDateTime = new Date(formData.scheduled_date);
      scheduledDateTime.setHours(parseInt(hours), parseInt(minutes));

      // Set max participants based on format
      let maxParticipants = parseInt(formData.max_participants);
      
      // Testing mode (1 player) bypasses all restrictions
      if (maxParticipants !== 1) {
        if (formData.format === 'Match Play') {
          maxParticipants = 2;
        } else if (formData.format === 'Best Ball' || formData.format === 'Scramble') {
          // Ensure even number for team formats
          maxParticipants = Math.max(4, Math.floor(maxParticipants / 2) * 2);
        }
      }

      const isTeamFormat = maxParticipants !== 1 && (formData.format === 'Best Ball' || formData.format === 'Scramble');

      // Parse numeric values safely
      const parsedBuyIn = !hasAccess('buy_in') ? 0 : Math.max(0, parseInt(formData.buy_in_amount) || 0);
      const parsedHandicapMin = formData.handicap_min && formData.handicap_min.trim() !== '' 
        ? parseInt(formData.handicap_min) 
        : undefined;
      const parsedHandicapMax = formData.handicap_max && formData.handicap_max.trim() !== '' 
        ? parseInt(formData.handicap_max) 
        : undefined;

      // Validate handicap range
      if (parsedHandicapMin !== undefined && parsedHandicapMax !== undefined && parsedHandicapMin > parsedHandicapMax) {
        toast.error('Minimum handicap must be less than or equal to maximum handicap');
        return;
      }

      const matchData = {
        course_name: formData.course_name,
        location: selectedCourse?.address?.split(',').slice(-2).join(',').trim() || formData.course_name,
        address: selectedCourse?.address || undefined,
        latitude: locationCoords?.latitude,
        longitude: locationCoords?.longitude,
        scheduled_time: scheduledDateTime.toISOString(),
        format: formData.format,
        pin: formData.pin || undefined,
        holes: parseInt(formData.holes),
        buy_in_amount: parsedBuyIn * 100,
        handicap_min: parsedHandicapMin,
        handicap_max: parsedHandicapMax,
        max_participants: maxParticipants,
        booking_url: formData.booking_url || undefined,
        tee_selection_mode: (formData.default_tees === 'pick-own' ? 'individual' : 'fixed') as 'fixed' | 'individual',
        default_tees: formData.default_tees === 'pick-own' ? undefined : formData.default_tees,
        is_team_format: isTeamFormat
      };

      const { error } = await createMatch(matchData, locationCoords || undefined);
      
      if (!error) {
        // Clear saved form data on successful submission
        localStorage.removeItem('matchFormData');
        navigate('/');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const isFormValid = formData.course_name && formData.scheduled_date && formData.format && formData.default_tees;

  const renderCourseStep = () => (
    <div className="space-y-3 max-h-[calc(100vh-200px)] overflow-y-auto">
      <Label>Golf Course *</Label>
      
      {/* AI Smart Search */}
      {isPaidSubscription && (
        <SmartCourseSearch 
          onResults={(results) => {
            // Smart search already updates the courses list via the hook
            if (results.length > 0) {
              setCourseOpen(true);
            }
          }}
        />
      )}
          
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
              disabled={loadingGPS || !hasAccess('gps_matching')}
              title={!hasAccess('gps_matching') ? 'Upgrade to enable GPS matching' : 'Use GPS location'}
            >
              {loadingGPS ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4" />}
            </Button>
          </div>
          {!hasAccess('gps_matching') && (
            <p className="text-xs text-warning">🔒 Upgrade to Local Player or Tournament Pro for GPS-based matching</p>
          )}
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
                      <span>Searching all sources...</span>
                    </div>
                  ) : (
                    <div className="py-6 px-4 text-center space-y-3">
                      <p className="text-sm text-muted-foreground">
                        {customSearchTerm.length < 3 
                          ? "Type at least 3 characters to search"
                          : "No courses found"
                        }
                      </p>
                      {user && customSearchTerm.length >= 3 && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCreateCourseOpen(true)}
                          className="w-full"
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Create New Course
                        </Button>
                      )}
                    </div>
                  )}
                </CommandEmpty>
                
                {/* Favorite Courses Section */}
                {user && favorites.length > 0 && (
                  <CommandGroup heading="Player Favorite Courses">
                    {favorites.map((favCourse) => {
                      const course = {
                        name: favCourse.course_name,
                        address: favCourse.address,
                        latitude: favCourse.latitude,
                        longitude: favCourse.longitude,
                      };
                      return (
                        <CommandItem
                          key={favCourse.id}
                          value={favCourse.course_name}
                          onSelect={() => handleCourseSelect(course)}
                          className="cursor-pointer"
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              selectedCourse?.name === favCourse.course_name ? "opacity-100" : "opacity-0"
                            )}
                          />
                          <div className="flex-1">
                            <div className="font-medium">{favCourse.course_name}</div>
                            <div className="text-xs text-muted-foreground">
                              {favCourse.address}
                            </div>
                          </div>
                          <Star
                            className="h-4 w-4 fill-primary text-primary"
                            onClick={(e) => handleToggleFavorite(e, course)}
                          />
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                )}
                
                {/* All Courses Section */}
                <CommandGroup heading={user && favorites.length > 0 ? "All Courses" : undefined}>
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
                        {/* AI-Enhanced Course Info */}
                        {(course.difficulty_level || course.course_style || course.ai_rating) && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {course.ai_rating && (
                              <Badge variant="secondary" className="text-xs">
                                <Star className="h-2 w-2 mr-1 fill-current" />
                                {course.ai_rating.toFixed(1)}
                              </Badge>
                            )}
                            {course.difficulty_level && (
                              <Badge variant="outline" className="text-xs">
                                {course.difficulty_level}
                              </Badge>
                            )}
                            {course.course_style && (
                              <Badge variant="outline" className="text-xs">
                                {course.course_style}
                              </Badge>
                            )}
                          </div>
                        )}
                      </div>
                      {user && (
                        <Star
                          className={cn(
                            "h-4 w-4 transition-colors",
                            isFavorite(course.name)
                              ? "fill-primary text-primary"
                              : "text-muted-foreground hover:text-primary"
                          )}
                          onClick={(e) => handleToggleFavorite(e, course)}
                        />
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </ScrollArea>
          </Command>
        </PopoverContent>
      </Popover>

      {/* AI Course Recommendations */}
      {isPaidSubscription && user && (
        <div className="pt-2">
          <CourseRecommendations />
        </div>
      )}

      {isPaidSubscription && formData.booking_url && (
        <div className="space-y-2">
          <Label>Tee Time Booking</Label>
          <Button
            type="button"
            variant="outline"
            className="w-full justify-start"
            onClick={() => window.open(formData.booking_url, '_blank')}
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            Book Tee Time
          </Button>
          <p className="text-xs text-muted-foreground">
            Auto-populated from course website
          </p>
        </div>
      )}
    </div>
  );

  const renderDateTimeStep = () => (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Date *</Label>
        <Popover open={dateOpen} onOpenChange={setDateOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn("w-full justify-start", !formData.scheduled_date && "text-muted-foreground")}
            >
              <Clock className="mr-2 h-4 w-4" />
              {formData.scheduled_date ? format(formData.scheduled_date, "MMM d, yyyy") : "Pick date"}
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
  );

  const getTimeWarning = () => {
    if (formData.holes === '9' && formData.scheduled_time) {
      const [hours] = formData.scheduled_time.split(':').map(Number);
      if (hours < 18) {
        return '9-hole matches can only be scheduled at or after 6:00 PM';
      }
    }
    return null;
  };

  const renderFormatTeesStep = () => {
    const timeWarning = getTimeWarning();
    
    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="format">Match Format *</Label>
          <Select value={formData.format} onValueChange={(value) => setFormData({ ...formData, format: value })}>
            <SelectTrigger id="format">
              <SelectValue placeholder="Select format" />
            </SelectTrigger>
            <SelectContent>
              <TooltipProvider>
                <div className="space-y-1">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="relative">
                        <SelectItem value="Stroke Play" className="pr-8">
                          Stroke Play
                        </SelectItem>
                        <Info className="w-3 h-3 absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="max-w-xs">
                      <p className="text-sm">Traditional golf scoring. Each player counts all strokes. Lowest total score wins.</p>
                    </TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="relative">
                        <SelectItem value="Match Play" className="pr-8">
                          Match Play (1v1)
                        </SelectItem>
                        <Info className="w-3 h-3 absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="max-w-xs">
                      <p className="text-sm">Head-to-head competition where each player compares their score on each hole. Lowest score wins the hole.</p>
                    </TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="relative">
                        <SelectItem value="Best Ball" className="pr-8">
                          Best Ball (2v2)
                        </SelectItem>
                        <Info className="w-3 h-3 absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="max-w-xs">
                      <p className="text-sm">Each player plays their own ball. The best score from each team on each hole is used for the team score.</p>
                    </TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="relative">
                        <SelectItem value="Scramble" className="pr-8">
                          Scramble (2v2)
                        </SelectItem>
                        <Info className="w-3 h-3 absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="max-w-xs">
                      <p className="text-sm">All teammates hit from each spot. After each shot, the team selects the best ball position and all players hit from there.</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
              </TooltipProvider>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="holes">Number of Holes *</Label>
          <Select value={formData.holes} onValueChange={(value) => setFormData({ ...formData, holes: value })}>
            <SelectTrigger id="holes">
              <SelectValue placeholder="Select holes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="18">18 Holes</SelectItem>
              <SelectItem value="9">9 Holes</SelectItem>
            </SelectContent>
          </Select>
          {timeWarning && (
            <p className="text-xs text-destructive flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {timeWarning}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="tees">Tee Selection *</Label>
          <Select value={formData.default_tees} onValueChange={(value) => setFormData({ ...formData, default_tees: value })}>
            <SelectTrigger id="tees">
              <SelectValue placeholder="Select tees" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="black">Black (Championship)</SelectItem>
              <SelectItem value="blue">Blue (Back)</SelectItem>
              <SelectItem value="white">White (Middle)</SelectItem>
              <SelectItem value="gold">Gold (Senior)</SelectItem>
              <SelectItem value="red">Red (Forward)</SelectItem>
              <SelectItem value="pick-own">Pick Your Own</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    );
  };

  const renderDetailsStep = () => (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Label htmlFor="buy_in" className="flex items-center gap-2">
            Buy-In Amount ($)
            {!hasAccess('buy_in') && <Lock className="w-4 h-4 text-muted-foreground" />}
          </Label>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="w-4 h-4 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p>Enter the buy-in amount between $0 and $500. This is the entry fee each player pays to join the match.</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <div className="relative">
          <Input
            id="buy_in"
            type="number"
            min="0"
            max="500"
            value={!hasAccess('buy_in') ? '0' : formData.buy_in_amount}
            onKeyDown={handleKeyDown}
            onChange={(e) => {
              const value = e.target.value;
              const numValue = parseInt(value) || 0;
              
              // Real-time validation
              let error = '';
              if (value !== '' && (numValue < 0 || numValue > 500)) {
                error = 'Buy-in must be between $0 and $500';
              }
              
              setValidationErrors({ ...validationErrors, buy_in_amount: error });
              setFormData({ ...formData, buy_in_amount: value === '' ? '0' : value });
            }}
            disabled={!hasAccess('buy_in')}
            className={cn(
              !hasAccess('buy_in') && 'bg-muted cursor-not-allowed',
              validationErrors.buy_in_amount && 'border-destructive'
            )}
          />
          {validationErrors.buy_in_amount && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <AlertCircle className="w-4 h-4 text-destructive" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{validationErrors.buy_in_amount}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          )}
        </div>
        {validationErrors.buy_in_amount && (
          <p className="text-xs text-destructive flex items-center gap-1">
            <AlertCircle className="w-3 h-3" />
            {validationErrors.buy_in_amount}
          </p>
        )}
        {hasAccess('buy_in') && !validationErrors.buy_in_amount && (
          <p className="text-xs text-muted-foreground">Default: $50 • Max: $500</p>
        )}
        {!hasAccess('buy_in') && (
          <p className="text-xs text-warning">Upgrade to Local Player or Tournament Pro to enable buy-ins</p>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Label>Handicap Range (Optional)</Label>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="w-4 h-4 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p>Set a handicap range to limit who can join. Valid range is -10 to 54. Leave empty to allow all handicaps.</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <div className="relative">
              <Input
                type="number"
                placeholder="Min"
                min="-10"
                max="54"
                value={formData.handicap_min}
                onKeyDown={handleKeyDown}
                onChange={(e) => {
                  const value = e.target.value;
                  const numValue = value !== '' ? parseInt(value) : null;
                  
                  // Real-time validation
                  let error = '';
                  if (numValue !== null && (numValue < -10 || numValue > 54)) {
                    error = 'Min: -10 to 54';
                  }
                  
                  // Check range validity
                  let rangeError = '';
                  const maxValue = formData.handicap_max !== '' ? parseInt(formData.handicap_max) : null;
                  if (numValue !== null && maxValue !== null && numValue > maxValue) {
                    rangeError = 'Min must be ≤ Max';
                  }
                  
                  setValidationErrors({ 
                    ...validationErrors, 
                    handicap_min: error,
                    handicap_range: rangeError
                  });
                  setFormData({ ...formData, handicap_min: value });
                }}
                className={cn(
                  (validationErrors.handicap_min || validationErrors.handicap_range) && 'border-destructive'
                )}
              />
              {validationErrors.handicap_min && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <AlertCircle className="w-4 h-4 text-destructive" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{validationErrors.handicap_min}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              )}
            </div>
            {validationErrors.handicap_min && (
              <p className="text-xs text-destructive">{validationErrors.handicap_min}</p>
            )}
          </div>
          
          <div className="space-y-1">
            <div className="relative">
              <Input
                type="number"
                placeholder="Max"
                min="-10"
                max="54"
                value={formData.handicap_max}
                onKeyDown={handleKeyDown}
                onChange={(e) => {
                  const value = e.target.value;
                  const numValue = value !== '' ? parseInt(value) : null;
                  
                  // Real-time validation
                  let error = '';
                  if (numValue !== null && (numValue < -10 || numValue > 54)) {
                    error = 'Max: -10 to 54';
                  }
                  
                  // Check range validity
                  let rangeError = '';
                  const minValue = formData.handicap_min !== '' ? parseInt(formData.handicap_min) : null;
                  if (numValue !== null && minValue !== null && minValue > numValue) {
                    rangeError = 'Min must be ≤ Max';
                  }
                  
                  setValidationErrors({ 
                    ...validationErrors, 
                    handicap_max: error,
                    handicap_range: rangeError
                  });
                  setFormData({ ...formData, handicap_max: value });
                }}
                className={cn(
                  (validationErrors.handicap_max || validationErrors.handicap_range) && 'border-destructive'
                )}
              />
              {validationErrors.handicap_max && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <AlertCircle className="w-4 h-4 text-destructive" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{validationErrors.handicap_max}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              )}
            </div>
            {validationErrors.handicap_max && (
              <p className="text-xs text-destructive">{validationErrors.handicap_max}</p>
            )}
          </div>
        </div>
        {validationErrors.handicap_range && (
          <p className="text-xs text-destructive flex items-center gap-1">
            <AlertCircle className="w-3 h-3" />
            {validationErrors.handicap_range}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="max_players">Max Players</Label>
        <Select 
          value={formData.max_participants} 
          onValueChange={(value) => setFormData({ ...formData, max_participants: value })}
          disabled={formData.max_participants !== '1' && (formData.format === 'Match Play' || formData.format === 'Best Ball' || formData.format === 'Scramble')}
        >
          <SelectTrigger id="max_players">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1">1 (Testing - No Payouts)</SelectItem>
            {formData.max_participants === '1' ? (
              <>
                <SelectItem value="2">2</SelectItem>
                <SelectItem value="3">3</SelectItem>
                <SelectItem value="4">4 (Default)</SelectItem>
                <SelectItem value="5">5</SelectItem>
                <SelectItem value="6">6</SelectItem>
                <SelectItem value="7">7</SelectItem>
                <SelectItem value="8">8</SelectItem>
              </>
            ) : formData.format === 'Match Play' ? (
              <SelectItem value="2">2 (Match Play)</SelectItem>
            ) : (formData.format === 'Best Ball' || formData.format === 'Scramble') ? (
              <>
                <SelectItem value="4">4 (2v2)</SelectItem>
                <SelectItem value="6">6 (3v3)</SelectItem>
                <SelectItem value="8">8 (4v4)</SelectItem>
              </>
            ) : (
              <>
                <SelectItem value="2">2</SelectItem>
                <SelectItem value="3">3</SelectItem>
                <SelectItem value="4">4 (Default)</SelectItem>
                <SelectItem value="5">5</SelectItem>
                <SelectItem value="6">6</SelectItem>
                <SelectItem value="7">7</SelectItem>
                <SelectItem value="8">8</SelectItem>
              </>
            )}
          </SelectContent>
        </Select>
        {formData.max_participants === '1' && (
          <p className="text-xs text-amber-600 dark:text-amber-400">Testing mode: All format restrictions disabled, no payouts</p>
        )}
        {formData.max_participants !== '1' && (formData.format === 'Best Ball' || formData.format === 'Scramble') && (
          <p className="text-xs text-muted-foreground">Teams of 2 will select teammates after joining</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="pin">Match PIN (Optional)</Label>
        <Input
          id="pin"
          type="text"
          inputMode="numeric"
          pattern="\d{4}"
          maxLength={4}
          value={formData.pin}
          onKeyDown={handleKeyDown}
          onChange={(e) => setFormData({ ...formData, pin: e.target.value.replace(/\D/g, '') })}
          placeholder="4-digit PIN"
          className="text-center tracking-widest font-mono"
        />
        <p className="text-xs text-muted-foreground">
          Set a 4-digit PIN to control who can join your match
          {formData.format === 'Best Ball' || formData.format === 'Scramble' ? ' (Team 1 PIN)' : ''}
        </p>
      </div>

    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background border-b pt-[env(safe-area-inset-top)]">
        <div className="container mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={handleCancel}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold">Create Match</h1>
          {isMobile && (
            <span className="ml-auto text-sm text-muted-foreground">
              Step {currentStep + 1} of 4
            </span>
          )}
        </div>
      </header>

      {/* Form */}
      <form onSubmit={(e) => e.preventDefault()} className="container mx-auto px-4 py-6 max-w-2xl">
        {isMobile ? (
          <div className="space-y-6">
            <div className="min-h-[60vh]">
              {currentStep === 0 && renderCourseStep()}
              {currentStep === 1 && renderDateTimeStep()}
              {currentStep === 2 && renderFormatTeesStep()}
              {currentStep === 3 && renderDetailsStep()}
            </div>

            <div className="flex gap-3 pt-4 border-t sticky bottom-0 bg-background pb-4">
              <Button
                type="button"
                variant="outline"
                onClick={handleCancel}
                className="flex-1"
              >
                Cancel
              </Button>
              {currentStep > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleBack}
                  className="flex-1"
                >
                  Back
                </Button>
              )}
              {currentStep < 3 ? (
                <Button
                  type="button"
                  onClick={handleNext}
                  disabled={!canGoNext()}
                  className="flex-1"
                >
                  Next
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={handleSubmit}
                  disabled={!isFormValid || submitting}
                  className="flex-1"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    'Create'
                  )}
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {renderCourseStep()}
            {renderDateTimeStep()}
            {renderFormatTeesStep()}
            {renderDetailsStep()}

            <div className="flex gap-3 pt-6">
              <Button
                type="button"
                variant="outline"
                onClick={handleCancel}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleSubmit}
                disabled={!isFormValid || submitting}
                className="flex-1"
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create Match'
                )}
              </Button>
            </div>
          </div>
        )}
      </form>

      <CreateCourseDialog
        open={createCourseOpen}
        onOpenChange={setCreateCourseOpen}
        onCourseCreated={handleCourseCreated}
        initialName={customSearchTerm}
      />
    </div>
  );
};

export default CreateMatch;
