import { useState } from 'react';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Calculator, Flag, Trophy } from 'lucide-react';
import { toast } from 'sonner';

function CourseHandicapForm({ onClose }: { onClose?: () => void }) {
  const [handicapIndex, setHandicapIndex] = useState('');
  const [courseRating, setCourseRating] = useState('');
  const [par, setPar] = useState('');
  const [courseHandicap, setCourseHandicap] = useState<number | null>(null);

  const calculate = () => {
    const hi = parseFloat(handicapIndex);
    const cr = parseFloat(courseRating);
    const sr = 113;
    const p = parseFloat(par);

    if (!handicapIndex || !courseRating || !par) {
      toast.error('Please fill in all fields');
      return;
    }
    if (hi < -10 || hi > 54) {
      toast.error('Handicap Index must be between -10 and 54');
      return;
    }
    if (p < 20 || p > 90) {
      toast.error('Par must be between 20 and 90');
      return;
    }
    const ch = Math.round(hi * (sr / 113) + (cr - p));
    setCourseHandicap(ch);
    toast.success(`Course Handicap calculated: ${ch}`);
  };

  const reset = () => {
    setHandicapIndex('');
    setCourseRating('');
    setPar('');
    setCourseHandicap(null);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4">
        <div className="space-y-2">
          <Label htmlFor="handicapIndex">Handicap Index®</Label>
          <Input id="handicapIndex" type="number" step="0.1" min="-10" max="54" placeholder="e.g., 15.0"
            value={handicapIndex} onChange={(e) => setHandicapIndex(e.target.value)} />
          <p className="text-xs text-muted-foreground">Range: -10 to 54</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="courseRating">Course Rating</Label>
          <Input id="courseRating" type="number" step="0.1" placeholder="e.g., 72.5"
            value={courseRating} onChange={(e) => setCourseRating(e.target.value)} />
          <p className="text-xs text-muted-foreground">From course scorecard</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="par">Par</Label>
          <Input id="par" type="number" min="20" max="90" placeholder="e.g., 72"
            value={par} onChange={(e) => setPar(e.target.value)} />
          <p className="text-xs text-muted-foreground">Range: 20 to 90</p>
        </div>
      </div>

      {courseHandicap !== null && (
        <div className="p-4 bg-accent/10 rounded-lg border border-accent/20 text-center">
          <p className="text-sm text-muted-foreground mb-1">Your Course Handicap is:</p>
          <p className="text-4xl font-bold text-accent">{courseHandicap}</p>
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <Button type="button" onClick={calculate} className="flex-1 bg-gradient-primary text-primary-foreground">
          Calculate
        </Button>
        <Button type="button" variant="outline" onClick={reset}>Reset</Button>
        {onClose && <Button type="button" variant="ghost" onClick={onClose}>Close</Button>}
      </div>

      <p className="text-xs text-muted-foreground">
        Note: For 9-hole Course Handicap, use half of your 18-hole Handicap Index and 9-hole course ratings.
      </p>
    </div>
  );
}

function PlayingHandicapForm({ onClose }: { onClose?: () => void }) {
  const [courseHandicapInput, setCourseHandicapInput] = useState('');
  const [handicapAllowance, setHandicapAllowance] = useState('100');
  const [playingHandicap, setPlayingHandicap] = useState<number | null>(null);

  const calculate = () => {
    const ch = parseFloat(courseHandicapInput);
    const allowance = parseFloat(handicapAllowance);
    if (!courseHandicapInput) {
      toast.error('Please enter a Course Handicap');
      return;
    }
    const ph = Math.round(ch * (allowance / 100));
    setPlayingHandicap(ph);
    toast.success(`Playing Handicap calculated: ${ph}`);
  };

  const reset = () => {
    setCourseHandicapInput('');
    setHandicapAllowance('100');
    setPlayingHandicap(null);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4">
        <div className="space-y-2">
          <Label htmlFor="courseHandicapInput">Course Handicap</Label>
          <Input id="courseHandicapInput" type="number" placeholder="e.g., 18"
            value={courseHandicapInput} onChange={(e) => setCourseHandicapInput(e.target.value)} />
          <p className="text-xs text-muted-foreground">From Course Handicap calculator</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="handicapAllowance">Handicap Allowance</Label>
          <Select value={handicapAllowance} onValueChange={setHandicapAllowance}>
            <SelectTrigger id="handicapAllowance" aria-label="Handicap Allowance">
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
          <p className="text-xs text-muted-foreground">Based on your match format</p>
        </div>
      </div>

      {playingHandicap !== null && (
        <div className="p-4 bg-accent/10 rounded-lg border border-accent/20 text-center">
          <p className="text-sm text-muted-foreground mb-1">Your Playing Handicap is:</p>
          <p className="text-4xl font-bold text-accent">{playingHandicap}</p>
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <Button type="button" onClick={calculate} className="flex-1 bg-gradient-primary text-primary-foreground">
          Calculate
        </Button>
        <Button type="button" variant="outline" onClick={reset}>Reset</Button>
        {onClose && <Button type="button" variant="ghost" onClick={onClose}>Close</Button>}
      </div>
    </div>
  );
}

export function HandicapCalculators() {
  return (
    <section className="py-20 px-6 bg-background" aria-labelledby="handicap-calculators-heading">
      <div className="max-w-7xl mx-auto">
        <aside className="bg-gradient-hero text-primary-foreground rounded-2xl p-8 md:p-12 shadow-card" aria-labelledby="handicap-calculators-heading">
          <div className="text-center mb-8">
            <div className="w-12 h-12 mx-auto mb-4 bg-accent text-accent-foreground rounded-xl flex items-center justify-center" aria-hidden="true">
              <Calculator className="w-6 h-6" />
            </div>
            <h2 id="handicap-calculators-heading" className="text-3xl md:text-4xl font-bold mb-4">
              Handicap Calculators
            </h2>
            <p className="text-primary-foreground/90 max-w-2xl mx-auto">
              Compute your Course Handicap and Playing Handicap before choosing your game level.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
            <Card className="bg-card text-card-foreground border-border shadow-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <Flag className="w-5 h-5 text-primary" aria-hidden="true" />
                  Course Handicap™
                </CardTitle>
                <CardDescription>For a specific course</CardDescription>
              </CardHeader>
              <CardContent>
                <CourseHandicapForm />
              </CardContent>
            </Card>

            <Card className="bg-card text-card-foreground border-border shadow-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <Trophy className="w-5 h-5 text-primary" aria-hidden="true" />
                  Playing Handicap
                </CardTitle>
                <CardDescription>Adjusted for match format</CardDescription>
              </CardHeader>
              <CardContent>
                <PlayingHandicapForm />
              </CardContent>
            </Card>
          </div>
        </aside>
      </div>
    </section>
  );
}
