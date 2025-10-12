import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Filter, X, Search, MapPin, DollarSign, Users, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface MatchFilters {
  search: string;
  format: string;
  maxDistance: number;
  buyInRange: [number, number];
  dateRange: string;
  spots: string;
}

interface MatchFiltersProps {
  filters: MatchFilters;
  onFiltersChange: (filters: MatchFilters) => void;
  matchCount: number;
  showFilters: boolean;
  onToggleFilters: () => void;
}

const MatchFilters = ({ 
  filters, 
  onFiltersChange, 
  matchCount,
  showFilters, 
  onToggleFilters 
}: MatchFiltersProps) => {
  const updateFilter = (key: keyof MatchFilters, value: any) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const clearFilters = () => {
    onFiltersChange({
      search: '',
      format: 'all',
      maxDistance: 30,
      buyInRange: [0, 500],
      dateRange: 'all',
      spots: 'all'
    });
  };

  const hasActiveFilters = 
    filters.search || 
    filters.format !== 'all' || 
    filters.maxDistance !== 30 || 
    filters.buyInRange[0] !== 0 || 
    filters.buyInRange[1] !== 500 ||
    filters.dateRange !== 'all' ||
    filters.spots !== 'all';

  return (
    <div className="space-y-4">
      {/* Filter Toggle & Search Bar */}
      <div className="space-y-2">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
          <div className="flex-1 relative">
            <div className="relative shadow-lg rounded-lg border-2 border-primary/20 bg-card hover:border-primary/40 transition-all duration-300">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-primary z-10" />
              <Input
                placeholder="Search courses or locations..."
                value={filters.search}
                onChange={(e) => updateFilter('search', e.target.value)}
                className="pl-10 border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 h-12 text-base"
              />
            </div>
          </div>

          <div className="flex gap-2">
            <div className="shadow-lg rounded-lg border-2 border-primary/20 bg-card hover:border-primary/40 transition-all duration-300">
              <Button
                variant="ghost"
                onClick={onToggleFilters}
                className="flex items-center gap-2 border-0 h-12"
              >
                <Filter className="h-4 w-4" />
                Filters
                {hasActiveFilters && (
                  <Badge variant="secondary" className="ml-1 px-1.5 py-0.5 text-xs">
                    {Object.values(filters).filter(v => 
                      v !== '' && v !== 'all' && v !== 30 && !Array.isArray(v)
                    ).length + (filters.buyInRange[0] !== 0 || filters.buyInRange[1] !== 500 ? 1 : 0)}
                  </Badge>
                )}
              </Button>
            </div>
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="text-muted-foreground hover:text-foreground h-12"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
        
        {/* Results Count - under search bar, right aligned */}
        <div className="text-sm text-muted-foreground font-medium text-right">
          {matchCount} match{matchCount !== 1 ? 'es' : ''} found
        </div>
      </div>

      {/* Advanced Filters Panel */}
      {showFilters && (
        <Card className="bg-muted/30">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">Filter Matches</CardTitle>
                <CardDescription>Narrow down your search</CardDescription>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={onToggleFilters}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {/* Match Format */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Match Format
                </Label>
                <Select value={filters.format} onValueChange={(value) => updateFilter('format', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Any format" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Any Format</SelectItem>
                    <SelectItem value="stroke-play">Stroke Play</SelectItem>
                    <SelectItem value="match-play">Match Play</SelectItem>
                    <SelectItem value="best-ball">2v2 Best Ball</SelectItem>
                    <SelectItem value="skins">Skins Game</SelectItem>
                    <SelectItem value="scramble">Scramble</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Date Range */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  When
                </Label>
                <Select value={filters.dateRange} onValueChange={(value) => updateFilter('dateRange', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Any time" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Any Time</SelectItem>
                    <SelectItem value="today">Today</SelectItem>
                    <SelectItem value="tomorrow">Tomorrow</SelectItem>
                    <SelectItem value="week">This Week</SelectItem>
                    <SelectItem value="weekend">Weekend</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Available Spots */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Availability
                </Label>
                <Select value={filters.spots} onValueChange={(value) => updateFilter('spots', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Any spots" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Any Availability</SelectItem>
                    <SelectItem value="1">1 spot available</SelectItem>
                    <SelectItem value="2+">2+ spots available</SelectItem>
                    <SelectItem value="3+">3+ spots available</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Separator />

            <div className="grid gap-6 md:grid-cols-2">
              {/* Distance Range */}
              <div className="space-y-3">
                <Label className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Max Distance: {filters.maxDistance}mi
                </Label>
                <Slider
                  value={[filters.maxDistance]}
                  onValueChange={([value]) => updateFilter('maxDistance', value)}
                  max={60}
                  min={3}
                  step={3}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>3mi</span>
                  <span>60mi</span>
                </div>
              </div>

              {/* Buy-in Range */}
              <div className="space-y-3">
                <Label className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Buy-in: ${filters.buyInRange[0]} - ${filters.buyInRange[1]}
                </Label>
                <Slider
                  value={filters.buyInRange}
                  onValueChange={(values) => updateFilter('buyInRange', values as [number, number])}
                  max={500}
                  min={0}
                  step={25}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>$0</span>
                  <span>$500+</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default MatchFilters;