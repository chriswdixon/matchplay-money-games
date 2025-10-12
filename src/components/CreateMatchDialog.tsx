import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, MapPin, Loader2, Check, ChevronsUpDown, Clock, X, ChevronRight } from 'lucide-react';
import { useMatches } from '@/hooks/useMatches';
import { useAuth } from '@/hooks/useAuth';
import { useLocation } from '@/hooks/useLocation';
import { useGolfCourses } from '@/hooks/useGolfCourses';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';

const CreateMatchDialog = ({ onMatchCreated }: { onMatchCreated?: () => void }) => {
  const [open, setOpen] = useState(false);
  const [courseOpen, setCourseOpen] = useState(false);
  const [dateTimeOpen, setDateTimeOpen] = useState(false);
  const [currentTab, setCurrentTab] = useState('course');
  const [formData, setFormData] = useState({
    course_name: '',
    scheduled_time: '',
    format: '',
    buy_in_amount: '50',
    handicap_min: '',
    handicap_max: '',
    max_participants: '4',
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

  const { createMatch } = useMatches();
  const { user } = useAuth();
  const { getCurrentLocation, geocodeAddress, loading: locationLoading } = useLocation();
  const { courses, loading: coursesLoading, searchNearbyCourses, searchCoursesByName, formatDistance } = useGolfCourses();
  const navigate = useNavigate();

  // Check if form is valid for submission
  const isFormValid = useMemo(() => {
    const hasCourseName = !!formData.course_name;
    const hasScheduledTime = !!formData.scheduled_time;
    const hasFormat = !!formData.format;
    const hasTeesWhenRequired = formData.tee_selection_mode === 'individual' || !!formData.default_tees;
    
    return hasCourseName && hasScheduledTime && hasFormat && hasTeesWhenRequired;
  }, [formData]);

  // Check if current tab is complete
  const isTab1Complete = useMemo(() => {
    return !!formData.course_name && !!formData.scheduled_time;
  }, [formData.course_name, formData.scheduled_time]);

  const isTab2Complete = useMemo(() => {
    const hasFormat = !!formData.format;
    const hasTeesWhenRequired = formData.tee_selection_mode === 'individual' || !!formData.default_tees;
    return hasFormat && hasTeesWhenRequired;
  }, [formData.format, formData.tee_selection_mode, formData.default_tees]);

  // Search for nearby courses when location is available
  useEffect(() => {
    if (locationCoords && courses.length === 0) {
      searchNearbyCourses(locationCoords.latitude, locationCoords.longitude, searchRadius);
    }
  }, [locationCoords, courses.length, searchNearbyCourses, searchRadius]);

  // Initialize search with all courses when dialog opens
  useEffect(() => {
    if (open && courses.length === 0) {
      searchCoursesByName(''); // This will show popular courses
    }
  }, [open, courses.length, searchCoursesByName]);

  const handleGetCurrentLocation = async () => {
    try {
      const location = await getCurrentLocation();
      setLocationCoords(location);
      searchNearbyCourses(location.latitude, location.longitude, searchRadius);
      setZipcode('');
      toast.success('Current location captured');
    } catch (error) {
      // Error is already handled by useLocation hook
    }
  };

  const handleZipcodeSearch = async () => {
    if (!zipcode || zipcode.length < 5) {
      toast.error('Please enter a valid 5-digit zipcode');
      return;
    }

    if (!/^\d{5}$/.test(zipcode)) {
      toast.error('Please enter a valid 5-digit zipcode');
      return;
    }

    try {
      setLoadingZipcode(true);
      const coords = await geocodeAddress(zipcode);
      
      if (coords) {
        setLocationCoords(coords);
        await searchNearbyCourses(coords.latitude, coords.longitude, searchRadius);
        toast.success(`Location found - searching within ${searchRadius} miles`);
      } else {
        toast.error('Could not find location for this zipcode. Try a different zipcode.');
      }
    } catch (error) {
      toast.error('Failed to search by zipcode. Please try again.');
    } finally {
      setLoadingZipcode(false);
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

  const handleCustomCourse = (courseName: string) => {
    setFormData({ ...formData, course_name: courseName });
    setSelectedCourse(null);
    searchCoursesByName(courseName);
  };

  const resetForm = () => {
    setFormData({
      course_name: '',
      scheduled_time: '',
      format: '',
      buy_in_amount: '50',
      handicap_min: '',
      handicap_max: '',
      max_participants: '4',
      booking_url: '',
      tee_selection_mode: 'fixed',
      default_tees: ''
    });
    setLocationCoords(null);
    setSelectedCourse(null);
    setCourseOpen(false);
    setTimeManuallySet(false);
    setHourDisplay('');
    setZipcode('');
    setCurrentTab('course');
  };

  const handleDialogChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) {
      resetForm();
    }
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
      setOpen(false);
      resetForm();
      onMatchCreated?.();
    }
  };

  const handleNextTab = () => {
    if (currentTab === 'course' && isTab1Complete) {
      setCurrentTab('format');
    } else if (currentTab === 'format' && isTab2Complete) {
      setCurrentTab('details');
    }
  };

  // Course selection field component (reused in tabs and desktop)
  const CourseField = () => (
    <div className="space-y-2">
      <Label htmlFor="course_name">Golf Course</Label>
      {!locationCoords && (
        <div className="space-y-2">
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleGetCurrentLocation}
              disabled={locationLoading}
              className="flex-1"
            >
              {locationLoading ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <MapPin className="w-4 h-4 mr-2" />
              )}
              Find courses near me
            </Button>
            
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
          </div>
          
          <div className="flex gap-2">
            <Input
              type="text"
              placeholder="Or enter zipcode"
              value={zipcode}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, '');
                setZipcode(value);
              }}
              maxLength={5}
              className="flex-1"
            />
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
        <PopoverContent className="w-[--radix-popover-trigger-width] max-w-none p-0 border shadow-lg z-[9999] pointer-events-auto bg-background" align="start" sideOffset={5}>
          <Command className="border-0">
            <CommandInput 
              placeholder="Search golf courses..." 
              onValueChange={handleCustomCourse}
              className="border-0"
            />
            <ScrollArea className="h-[300px]">
              <CommandList>
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
                <CommandGroup>
                  {courses.map((course) => (
                    <CommandItem
                      key={`${course.name}-${course.latitude}-${course.longitude}`}
                      value={course.name}
                      className="cursor-pointer rounded-sm px-2 py-3 text-sm outline-none aria-selected:bg-accent aria-selected:text-accent-foreground hover:bg-accent/50"
                      onSelect={() => handleCourseSelect(course)}
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
              </CommandList>
            </ScrollArea>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );

  // Date/Time field component
  const DateTimeField = () => (
    <div className="space-y-2">
      <Label htmlFor="scheduled_time">Date & Time</Label>
      <Popover open={dateTimeOpen} onOpenChange={setDateTimeOpen}>
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
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Pick Date & Time</Label>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-6 w-6 p-0"
                onClick={() => setDateTimeOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div>
              <Label className="text-sm font-medium mb-2 block">Date</Label>
              <Calendar
                mode="single"
                selected={formData.scheduled_time ? new Date(formData.scheduled_time) : undefined}
                onSelect={(date) => {
                  if (date) {
                    let newDateTime = new Date(date);
                    
                    if (!timeManuallySet && !formData.scheduled_time) {
                      const today = new Date();
                      const selectedDate = new Date(date);
                      const isToday = selectedDate.toDateString() === today.toDateString();
                      
                      if (isToday) {
                        newDateTime.setHours(today.getHours(), today.getMinutes());
                      } else {
                        newDateTime.setHours(7, 0);
                      }
                    } else if (formData.scheduled_time) {
                      const existingTime = new Date(formData.scheduled_time);
                      newDateTime.setHours(existingTime.getHours(), existingTime.getMinutes());
                    } else {
                      newDateTime.setHours(7, 0);
                    }
                    
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
              <div className="flex gap-2 items-center">
                <Input
                  type="number"
                  min="1"
                  max="12"
                  placeholder="12"
                  value={hourDisplay || (formData.scheduled_time ? (() => {
                    const date = new Date(formData.scheduled_time);
                    const hours = date.getHours();
                    return hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
                  })() : '')}
                  onChange={(e) => {
                    const value = e.target.value;
                    const inputHour = parseInt(value);
                    
                    if (value === '' || (inputHour >= 1 && inputHour <= 12)) {
                      setHourDisplay(value);
                      
                      if (inputHour >= 1 && inputHour <= 12) {
                        const currentDate = formData.scheduled_time ? new Date(formData.scheduled_time) : new Date();
                        const isAM = currentDate.getHours() < 12;
                        let hour24 = inputHour;
                        
                        if (isAM && inputHour === 12) hour24 = 0;
                        else if (!isAM && inputHour !== 12) hour24 = inputHour + 12;
                        
                        currentDate.setHours(hour24);
                        
                        const year = currentDate.getFullYear();
                        const month = String(currentDate.getMonth() + 1).padStart(2, '0');
                        const day = String(currentDate.getDate()).padStart(2, '0');
                        const hours = String(currentDate.getHours()).padStart(2, '0');
                        const minutes = String(currentDate.getMinutes()).padStart(2, '0');
                        const localDateTime = `${year}-${month}-${day}T${hours}:${minutes}`;
                        
                        setFormData({ ...formData, scheduled_time: localDateTime });
                        setTimeManuallySet(true);
                      }
                    }
                  }}
                  onBlur={() => setHourDisplay('')}
                  className="w-16 text-center"
                />
                <span className="text-muted-foreground">:</span>
                <Input
                  type="number"
                  min="0"
                  max="59"
                  placeholder="00"
                  value={formData.scheduled_time ? new Date(formData.scheduled_time).getMinutes().toString().padStart(2, '0') : ''}
                  onChange={(e) => {
                    const currentDate = formData.scheduled_time ? new Date(formData.scheduled_time) : new Date();
                    const minutes = parseInt(e.target.value) || 0;
                    currentDate.setMinutes(minutes);
                    
                    const year = currentDate.getFullYear();
                    const month = String(currentDate.getMonth() + 1).padStart(2, '0');
                    const day = String(currentDate.getDate()).padStart(2, '0');
                    const hours = String(currentDate.getHours()).padStart(2, '0');
                    const mins = String(currentDate.getMinutes()).padStart(2, '0');
                    const localDateTime = `${year}-${month}-${day}T${hours}:${mins}`;
                    
                    setFormData({ ...formData, scheduled_time: localDateTime });
                    setTimeManuallySet(true);
                  }}
                  className="w-16 text-center"
                />
                <Select 
                  value={formData.scheduled_time ? (new Date(formData.scheduled_time).getHours() < 12 ? 'AM' : 'PM') : 'PM'}
                  onValueChange={(value) => {
                    const currentDate = formData.scheduled_time ? new Date(formData.scheduled_time) : new Date();
                    const currentHours = currentDate.getHours();
                    const isCurrentlyAM = currentHours < 12;
                    const newIsAM = value === 'AM';
                    
                    if (isCurrentlyAM !== newIsAM) {
                      if (newIsAM) {
                        currentDate.setHours(currentHours - 12);
                      } else {
                        currentDate.setHours(currentHours + 12);
                      }
                    }
                    
                    const year = currentDate.getFullYear();
                    const month = String(currentDate.getMonth() + 1).padStart(2, '0');
                    const day = String(currentDate.getDate()).padStart(2, '0');
                    const hours = String(currentDate.getHours()).padStart(2, '0');
                    const minutes = String(currentDate.getMinutes()).padStart(2, '0');
                    const localDateTime = `${year}-${month}-${day}T${hours}:${minutes}`;
                    
                    setFormData({ ...formData, scheduled_time: localDateTime });
                    setTimeManuallySet(true);
                  }}
                >
                  <SelectTrigger className="w-16">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="AM">AM</SelectItem>
                    <SelectItem value="PM">PM</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-end pt-2">
              <Button 
                type="button"
                size="sm"
                onClick={() => setDateTimeOpen(false)}
                className="bg-gradient-primary text-primary-foreground"
              >
                Done
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={handleDialogChange}>
      <DialogTrigger asChild>
        <Button 
          className="bg-gradient-primary text-primary-foreground hover:shadow-premium"
          onClick={(e) => {
            if (!user) {
              e.preventDefault();
              navigate('/auth');
            }
          }}
        >
          <Plus className="w-4 h-4 mr-2" />
          {user ? 'Create Match' : 'Sign In to Create Match'}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px] p-0 gap-0 max-h-[90vh] flex flex-col">
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle>Create New Match</DialogTitle>
          <DialogDescription>
            Set up a new golf match and invite others to join.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col">
          {/* Mobile: Tabbed Interface */}
          <div className="flex-1 flex flex-col md:hidden">
            <Tabs value={currentTab} onValueChange={setCurrentTab} className="flex-1 flex flex-col">
              <div className="px-6 pt-4 pb-2">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="course" className="text-xs">Course</TabsTrigger>
                  <TabsTrigger value="format" className="text-xs">Format</TabsTrigger>
                  <TabsTrigger value="details" className="text-xs">Details</TabsTrigger>
                </TabsList>
              </div>
              
              <ScrollArea className="flex-1 px-6 pointer-events-auto">
                <TabsContent value="course" className="space-y-4 mt-0 pointer-events-auto">
                  <CourseField />
                  <DateTimeField />
                  <div className="space-y-2">
                    <Label htmlFor="booking_url">Tee Time Booking URL (Optional)</Label>
                    <Input
                      id="booking_url"
                      type="url"
                      value={formData.booking_url}
                      onChange={(e) => setFormData({ ...formData, booking_url: e.target.value })}
                      placeholder="https://example.com/book-tee-time"
                    />
                  </div>
                </TabsContent>

                <TabsContent value="format" className="space-y-4 mt-0 pointer-events-auto">
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

                  <div className="space-y-3">
                    <Label>Tee Selection</Label>
                    <Select 
                      value={formData.tee_selection_mode} 
                      onValueChange={(value: 'fixed' | 'individual') => setFormData({ ...formData, tee_selection_mode: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="fixed">Creator selects tees for everyone</SelectItem>
                        <SelectItem value="individual">Each participant picks their own tees</SelectItem>
                      </SelectContent>
                    </Select>
                    
                    {formData.tee_selection_mode === 'fixed' && (
                      <div className="space-y-2">
                        <Label htmlFor="default_tees">Which Tees?</Label>
                        <Select 
                          value={formData.default_tees} 
                          onValueChange={(value) => setFormData({ ...formData, default_tees: value })}
                        >
                          <SelectTrigger>
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
                </TabsContent>

                <TabsContent value="details" className="space-y-4 mt-0 pointer-events-auto">
                  <div className="space-y-2">
                    <Label htmlFor="buy_in_amount">Buy-in Amount ($)</Label>
                    <Input
                      id="buy_in_amount"
                      type="number"
                      min="0"
                      max="500"
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
                        <SelectItem value="1">1 Player (Testing)</SelectItem>
                        <SelectItem value="2">2 Players</SelectItem>
                        <SelectItem value="3">3 Players</SelectItem>
                        <SelectItem value="4">4 Players</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </TabsContent>
              </ScrollArea>
            </Tabs>

            {/* Fixed Bottom Buttons for Mobile */}
            <div className="flex gap-2 p-6 border-t bg-background">
              <Button type="button" variant="outline" onClick={() => setOpen(false)} className="flex-1">
                Cancel
              </Button>
              {!isFormValid ? (
                <Button 
                  type="button" 
                  onClick={handleNextTab}
                  disabled={
                    (currentTab === 'course' && !isTab1Complete) || 
                    (currentTab === 'format' && !isTab2Complete)
                  }
                  className="flex-1 bg-gradient-primary text-primary-foreground"
                >
                  Next
                  <ChevronRight className="w-4 h-4 ml-2" />
                </Button>
              ) : (
                <Button type="submit" className="flex-1 bg-gradient-primary text-primary-foreground">
                  Create Match
                </Button>
              )}
            </div>
          </div>

          {/* Desktop: Traditional Scrolling Form */}
          <div className="hidden md:block">
            <ScrollArea className="h-[500px] px-6">
              <div className="space-y-4 pb-4">
                <CourseField />
                <DateTimeField />
                
                <div className="space-y-2">
                  <Label htmlFor="booking_url">Tee Time Booking URL (Optional)</Label>
                  <Input
                    id="booking_url"
                    type="url"
                    value={formData.booking_url}
                    onChange={(e) => setFormData({ ...formData, booking_url: e.target.value })}
                    placeholder="https://example.com/book-tee-time"
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

                <div className="space-y-3">
                  <Label>Tee Selection</Label>
                  <Select 
                    value={formData.tee_selection_mode} 
                    onValueChange={(value: 'fixed' | 'individual') => setFormData({ ...formData, tee_selection_mode: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fixed">Creator selects tees for everyone</SelectItem>
                      <SelectItem value="individual">Each participant picks their own tees</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  {formData.tee_selection_mode === 'fixed' && (
                    <div className="space-y-2">
                      <Label htmlFor="default_tees">Which Tees?</Label>
                      <Select 
                        value={formData.default_tees} 
                        onValueChange={(value) => setFormData({ ...formData, default_tees: value })}
                      >
                        <SelectTrigger>
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
                
                <div className="space-y-2">
                  <Label htmlFor="buy_in_amount">Buy-in Amount ($)</Label>
                  <Input
                    id="buy_in_amount"
                    type="number"
                    min="0"
                    max="500"
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
                      <SelectItem value="1">1 Player (Testing)</SelectItem>
                      <SelectItem value="2">2 Players</SelectItem>
                      <SelectItem value="3">3 Players</SelectItem>
                      <SelectItem value="4">4 Players</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </ScrollArea>
            
            <div className="flex justify-end space-x-2 px-6 py-4 border-t">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="bg-gradient-primary text-primary-foreground" disabled={!isFormValid}>
                Create Match
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CreateMatchDialog;
