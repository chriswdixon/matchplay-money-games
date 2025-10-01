import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calculator } from 'lucide-react';
import { toast } from 'sonner';

export function HandicapCalculators() {
  // Course Handicap Calculator state
  const [handicapIndex, setHandicapIndex] = useState('');
  const [courseRating, setCourseRating] = useState('');
  const [slopeRating, setSlopeRating] = useState('');
  const [par, setPar] = useState('');
  const [courseHandicap, setCourseHandicap] = useState<number | null>(null);

  // Playing Handicap Calculator state
  const [courseHandicapInput, setCourseHandicapInput] = useState('');
  const [handicapAllowance, setHandicapAllowance] = useState('100');
  const [playingHandicap, setPlayingHandicap] = useState<number | null>(null);

  const calculateCourseHandicap = () => {
    const hi = parseFloat(handicapIndex);
    const cr = parseFloat(courseRating);
    const sr = parseFloat(slopeRating);
    const p = parseFloat(par);

    // Validation
    if (!handicapIndex || !courseRating || !slopeRating || !par) {
      toast.error('Please fill in all fields');
      return;
    }

    if (hi < -10 || hi > 54) {
      toast.error('Handicap Index must be between -10 and 54');
      return;
    }

    if (sr < 55 || sr > 155) {
      toast.error('Slope Rating must be between 55 and 155');
      return;
    }

    if (p < 20 || p > 90) {
      toast.error('Par must be between 20 and 90');
      return;
    }

    // Formula: Course Handicap = Handicap Index × (Slope Rating / 113) + (Course Rating - Par)
    const ch = Math.round(hi * (sr / 113) + (cr - p));
    setCourseHandicap(ch);
    setCourseHandicapInput(ch.toString());
    toast.success(`Course Handicap calculated: ${ch}`);
  };

  const calculatePlayingHandicap = () => {
    const ch = parseFloat(courseHandicapInput);
    const allowance = parseFloat(handicapAllowance);

    if (!courseHandicapInput) {
      toast.error('Please enter a Course Handicap');
      return;
    }

    // Formula: Playing Handicap = Course Handicap × (Allowance / 100)
    const ph = Math.round(ch * (allowance / 100));
    setPlayingHandicap(ph);
    toast.success(`Playing Handicap calculated: ${ph}`);
  };

  const resetCourseCalculator = () => {
    setHandicapIndex('');
    setCourseRating('');
    setSlopeRating('');
    setPar('');
    setCourseHandicap(null);
  };

  const resetPlayingCalculator = () => {
    setCourseHandicapInput('');
    setHandicapAllowance('100');
    setPlayingHandicap(null);
  };

  return (
    <section className="py-16 px-6 bg-muted/30">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Golf Handicap Calculators
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Calculate your Course Handicap and Playing Handicap for any golf course
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Course Handicap Calculator */}
          <Card className="shadow-card">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gradient-primary rounded-lg">
                  <Calculator className="w-5 h-5 text-primary-foreground" />
                </div>
                <div>
                  <CardTitle>Course Handicap™ Calculator</CardTitle>
                  <CardDescription>
                    Calculate your course handicap for a specific golf course
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="handicapIndex">Handicap Index®</Label>
                  <Input
                    id="handicapIndex"
                    type="number"
                    step="0.1"
                    min="-10"
                    max="54"
                    placeholder="e.g., 15.0"
                    value={handicapIndex}
                    onChange={(e) => setHandicapIndex(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Range: -10 to 54
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="courseRating">Course Rating</Label>
                  <Input
                    id="courseRating"
                    type="number"
                    step="0.1"
                    placeholder="e.g., 72.5"
                    value={courseRating}
                    onChange={(e) => setCourseRating(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    From course scorecard
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="slopeRating">Slope Rating™</Label>
                  <Input
                    id="slopeRating"
                    type="number"
                    min="55"
                    max="155"
                    placeholder="e.g., 130"
                    value={slopeRating}
                    onChange={(e) => setSlopeRating(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Range: 55 to 155
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="par">Par</Label>
                  <Input
                    id="par"
                    type="number"
                    min="20"
                    max="90"
                    placeholder="e.g., 72"
                    value={par}
                    onChange={(e) => setPar(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Range: 20 to 90
                  </p>
                </div>
              </div>

              {courseHandicap !== null && (
                <div className="p-4 bg-accent/10 rounded-lg border border-accent/20">
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground mb-1">Your Course Handicap is:</p>
                    <p className="text-4xl font-bold text-accent">{courseHandicap}</p>
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  onClick={calculateCourseHandicap}
                  className="flex-1 bg-gradient-primary text-primary-foreground"
                >
                  Calculate
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={resetCourseCalculator}
                >
                  Reset
                </Button>
              </div>

              <p className="text-xs text-muted-foreground">
                Note: For 9-hole Course Handicap, use half of your 18-hole Handicap Index and 9-hole course ratings.
              </p>
            </CardContent>
          </Card>

          {/* Playing Handicap Calculator */}
          <Card className="shadow-card">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gradient-primary rounded-lg">
                  <Calculator className="w-5 h-5 text-primary-foreground" />
                </div>
                <div>
                  <CardTitle>Playing Handicap Calculator</CardTitle>
                  <CardDescription>
                    Calculate your playing handicap based on match format
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="courseHandicapInput">Course Handicap</Label>
                  <Input
                    id="courseHandicapInput"
                    type="number"
                    placeholder="e.g., 18"
                    value={courseHandicapInput}
                    onChange={(e) => setCourseHandicapInput(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    From Course Handicap calculator
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="handicapAllowance">Handicap Allowance</Label>
                  <Select value={handicapAllowance} onValueChange={setHandicapAllowance}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="100">100% (Individual Stroke Play)</SelectItem>
                      <SelectItem value="95">95% (Individual Match Play)</SelectItem>
                      <SelectItem value="85">85% (Four-Ball Stroke Play)</SelectItem>
                      <SelectItem value="90">90% (Four-Ball Match Play)</SelectItem>
                      <SelectItem value="50">50% (Scramble - 2 players)</SelectItem>
                      <SelectItem value="35">35% (Scramble - 4 players)</SelectItem>
                      <SelectItem value="75">75% (Chapman/Pinehurst)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Based on your match format
                  </p>
                </div>
              </div>

              {playingHandicap !== null && (
                <div className="p-4 bg-accent/10 rounded-lg border border-accent/20">
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground mb-1">Your Playing Handicap is:</p>
                    <p className="text-4xl font-bold text-accent">{playingHandicap}</p>
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  onClick={calculatePlayingHandicap}
                  className="flex-1 bg-gradient-primary text-primary-foreground"
                >
                  Calculate
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={resetPlayingCalculator}
                >
                  Reset
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}
