import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Loader2, Check, ChevronsUpDown, Clock, X, ChevronRight } from 'lucide-react';
import { useMatches } from '@/hooks/useMatches';
import { useAuth } from '@/hooks/useAuth';
import { useLocation } from '@/hooks/useLocation';
import { useGolfCourses } from '@/hooks/useGolfCourses';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';

const CreateMatch = () => {
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
  const { geocodeAddress } = useLocation();
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

  // Initialize search with all courses when page loads
  useEffect(() => {
    if (courses.length === 0) {
      searchCoursesByName('');
    }
  }, [courses.length, searchCoursesByName]);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      toast.error('Please sign in to create a match');
      navigate('/auth');
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
      navigate('/');
    }
  };

  const handleNextTab = () => {
    if (currentTab === 'course' && isTab1Complete) {
      setCurrentTab('format');
    } else if (currentTab === 'format' && isTab2Complete) {
      setCurrentTab('details');
    }
  };

  // Course selection field component
  const CourseField = () => (
    <div className="space-y-2">
      <Label htmlFor="course_name">Golf Course</Label>
      {!locationCoords && (
        <div className="space-y-2">
          <div className="flex gap-2">
            <Input
              type="text"
              placeholder="Enter zipcode to find courses"
              value={zipcode}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, '');
                setZipcode(value);
              }}
              maxLength={5}
              className="flex-1"
              autoComplete="postal-code"
              inputMode="numeric"
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
        <PopoverContent className="w-[--radix-popover-trigger-width] max-w-none p-0" align="start" sideOffset={5}>
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
                      <span className="text-muted-foreground">Loading courses...</span>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground py-4">No courses found. Try a different search.</p>
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
        <PopoverContent className="w-auto p-0" align="start">
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
                className="p-3"
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
                    setHourDisplay(value);
                    
                    if (value && formData.scheduled_time) {
                      const currentDate = new Date(formData.scheduled_time);
                      const currentHours = currentDate.getHours();
                      const isPM = currentHours >= 12;
                      let newHour = parseInt(value);
                      
                      if (isPM && newHour !== 12) {
                        newHour += 12;
                      } else if (!isPM && newHour === 12) {
                        newHour = 0;
                      }
                      
                      currentDate.setHours(newHour);
                      const localDateTime = currentDate.toISOString().slice(0, 16);
                      setFormData({ ...formData, scheduled_time: localDateTime });
                      setTimeManuallySet(true);
                    }
                  }}
                  className="w-16"
                />
                <span className="text-lg">:</span>
                <Input
                  type="number"
                  min="0"
                  max="59"
                  placeholder="00"
                  value={formData.scheduled_time ? new Date(formData.scheduled_time).getMinutes().toString().padStart(2, '0') : ''}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (formData.scheduled_time) {
                      const currentDate = new Date(formData.scheduled_time);
                      currentDate.setMinutes(parseInt(value) || 0);
                      const localDateTime = currentDate.toISOString().slice(0, 16);
                      setFormData({ ...formData, scheduled_time: localDateTime });
                      setTimeManuallySet(true);
                    }
                  }}
                  className="w-16"
                />
                <Select
                  value={formData.scheduled_time ? (new Date(formData.scheduled_time).getHours() >= 12 ? 'PM' : 'AM') : 'AM'}
                  onValueChange={(value) => {
                    if (formData.scheduled_time) {
                      const currentDate = new Date(formData.scheduled_time);
                      const currentHours = currentDate.getHours();
                      const is24Hour = currentHours >= 12;
                      const isPMSelected = value === 'PM';
                      
                      let newHours = currentHours % 12;
                      if (isPMSelected && !is24Hour) {
                        newHours += 12;
                      } else if (!isPMSelected && is24Hour) {
                        newHours = currentHours - 12;
                      }
                      
                      currentDate.setHours(newHours);
                      const localDateTime = currentDate.toISOString().slice(0, 16);
                      setFormData({ ...formData, scheduled_time: localDateTime });
                      setTimeManuallySet(true);
                    }
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
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/')}
            className="mr-2"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <h1 className="text-lg font-semibold">Create New Match</h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="container max-w-2xl py-6 pb-32 relative">
        <form onSubmit={handleSubmit} className="space-y-6 relative z-0">
          {/* Mobile: Tabbed Interface */}
          <div className="md:hidden">
            <Tabs value={currentTab} onValueChange={setCurrentTab} className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="course">Course</TabsTrigger>
                <TabsTrigger value="format">Format</TabsTrigger>
                <TabsTrigger value="details">Details</TabsTrigger>
              </TabsList>
              
              <TabsContent value="course" className="space-y-4 mt-4 relative z-0">
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

              <TabsContent value="format" className="space-y-4 mt-4">
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

              <TabsContent value="details" className="space-y-4 mt-4">
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
            </Tabs>
          </div>

          {/* Desktop: All fields visible */}
          <div className="hidden md:block space-y-4">
            <CourseField />
            <DateTimeField />
            
            <div className="space-y-2">
              <Label htmlFor="booking_url_desktop">Tee Time Booking URL (Optional)</Label>
              <Input
                id="booking_url_desktop"
                type="url"
                value={formData.booking_url}
                onChange={(e) => setFormData({ ...formData, booking_url: e.target.value })}
                placeholder="https://example.com/book-tee-time"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="format_desktop">Match Format</Label>
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
                  <Label htmlFor="default_tees_desktop">Which Tees?</Label>
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
              <Label htmlFor="buy_in_amount_desktop">Buy-in Amount ($)</Label>
              <Input
                id="buy_in_amount_desktop"
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
                <Label htmlFor="handicap_min_desktop">Min Handicap</Label>
                <Input
                  id="handicap_min_desktop"
                  type="number"
                  min="0"
                  max="54"
                  value={formData.handicap_min}
                  onChange={(e) => setFormData({ ...formData, handicap_min: e.target.value })}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="handicap_max_desktop">Max Handicap</Label>
                <Input
                  id="handicap_max_desktop"
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
              <Label htmlFor="max_participants_desktop">Max Participants</Label>
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
        </form>
      </main>

      {/* Fixed Bottom Bar - Mobile Only */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 border-t bg-background p-4 z-40">
        <div className="container flex gap-2">
          <Button type="button" variant="outline" onClick={() => navigate('/')} className="flex-1">
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
            <Button 
              type="submit" 
              onClick={handleSubmit}
              className="flex-1 bg-gradient-primary text-primary-foreground"
            >
              Create Match
            </Button>
          )}
        </div>
      </div>

      {/* Desktop Submit Bar */}
      <div className="hidden md:block fixed bottom-0 left-0 right-0 border-t bg-background p-4 z-40">
        <div className="container max-w-2xl flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => navigate('/')}>
            Cancel
          </Button>
          <Button 
            type="submit" 
            onClick={handleSubmit}
            className="bg-gradient-primary text-primary-foreground" 
            disabled={!isFormValid}
          >
            Create Match
          </Button>
        </div>
      </div>
    </div>
  );
};

export default CreateMatch;
