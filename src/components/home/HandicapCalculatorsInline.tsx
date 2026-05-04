import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calculator, Trophy } from 'lucide-react';
import { toast } from 'sonner';

export function HandicapCalculatorsInline() {
  // Course Handicap
  const [handicapIndex, setHandicapIndex] = useState('');
  const [courseRating, setCourseRating] = useState('');
  const [slopeRating, setSlopeRating] = useState('');
  const [par, setPar] = useState('');
  const [courseHandicap, setCourseHandicap] = useState<number | null>(null);

  // Playing Handicap
  const [courseHandicapInput, setCourseHandicapInput] = useState('');
  const [handicapAllowance, setHandicapAllowance] = useState('100');
  const [playingHandicap, setPlayingHandicap] = useState<number | null>(null);

  const calculateCourseHandicap = () => {
    const hi = parseFloat(handicapIndex);
    const cr = parseFloat(courseRating);
    const sr = parseFloat(slopeRating);
    const p = parseFloat(par);

    if (!handicapIndex || !courseRating || !slopeRating || !par) {
      toast.error('Please fill in all fields');
      return;
    }
    if (hi < -10 || hi > 54) return toast.error('Handicap Index must be between -10 and 54');
    if (sr < 55 || sr > 155) return toast.error('Slope Rating must be between 55 and 155');
    if (p < 20 || p > 90) return toast.error('Par must be between 20 and 90');

    const ch = Math.round(hi * (sr / 113) + (cr - p));
    setCourseHandicap(ch);
    setCourseHandicapInput(ch.toString());
  };

  const calculatePlayingHandicap = () => {
    const ch = parseFloat(courseHandicapInput);
    const allowance = parseFloat(handicapAllowance);
    if (!courseHandicapInput) return toast.error('Please enter a Course Handicap');
    const ph = Math.round(ch * (allowance / 100));
    setPlayingHandicap(ph);
  };

  const resetCourse = () => {
    setHandicapIndex('');
    setCourseRating('');
    setSlopeRating('');
    setPar('');
    setCourseHandicap(null);
  };

  const resetPlaying = () => {
    setCourseHandicapInput('');
    setHandicapAllowance('100');
    setPlayingHandicap(null);
  };

  return (
    <div className="bg-card rounded-3xl p-4 shadow-card space-y-4">
      <div className="flex items-center gap-2">
        <Trophy className="w-6 h-6 text-primary" aria-hidden="true" />
        <h2 className="text-2xl font-bold">Handicap Calculators</h2>
      </div>
      <p className="text-sm text-muted-foreground">
        Compute your Course Handicap and Playing Handicap for any round.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Course Handicap Card */}
        <Card className="shadow-card">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Calculator className="w-5 h-5" aria-hidden="true" />
              Course Handicap™
            </CardTitle>
            <CardDescription>For a specific course</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="hci">Handicap Index®</Label>
                <Input id="hci" type="number" step="0.1" min="-10" max="54"
                  placeholder="e.g., 15.0" value={handicapIndex}
                  onChange={(e) => setHandicapIndex(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cr">Course Rating</Label>
                <Input id="cr" type="number" step="0.1" placeholder="e.g., 72.5"
                  value={courseRating} onChange={(e) => setCourseRating(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sr">Slope Rating™</Label>
                <Input id="sr" type="number" min="55" max="155" placeholder="e.g., 130"
                  value={slopeRating} onChange={(e) => setSlopeRating(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="par">Par</Label>
                <Input id="par" type="number" min="20" max="90" placeholder="e.g., 72"
                  value={par} onChange={(e) => setPar(e.target.value)} />
              </div>
            </div>

            {courseHandicap !== null && (
              <div className="p-3 bg-accent/10 rounded-lg border border-accent/20 text-center">
                <p className="text-xs text-muted-foreground mb-1">Course Handicap</p>
                <p className="text-3xl font-bold text-accent">{courseHandicap}</p>
              </div>
            )}

            <div className="flex gap-2">
              <Button onClick={calculateCourseHandicap}
                className="flex-1 bg-gradient-primary text-primary-foreground">
                Calculate
              </Button>
              <Button variant="outline" onClick={resetCourse}>Reset</Button>
            </div>
          </CardContent>
        </Card>

        {/* Playing Handicap Card */}
        <Card className="shadow-card">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Calculator className="w-5 h-5" aria-hidden="true" />
              Playing Handicap
            </CardTitle>
            <CardDescription>Based on match format</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="chi">Course Handicap</Label>
                <Input id="chi" type="number" placeholder="e.g., 18"
                  value={courseHandicapInput}
                  onChange={(e) => setCourseHandicapInput(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="allowance">Handicap Allowance</Label>
                <Select value={handicapAllowance} onValueChange={setHandicapAllowance}>
                  <SelectTrigger id="allowance"><SelectValue /></SelectTrigger>
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
              </div>
            </div>

            {playingHandicap !== null && (
              <div className="p-3 bg-accent/10 rounded-lg border border-accent/20 text-center">
                <p className="text-xs text-muted-foreground mb-1">Playing Handicap</p>
                <p className="text-3xl font-bold text-accent">{playingHandicap}</p>
              </div>
            )}

            <div className="flex gap-2">
              <Button onClick={calculatePlayingHandicap}
                className="flex-1 bg-gradient-primary text-primary-foreground">
                Calculate
              </Button>
              <Button variant="outline" onClick={resetPlaying}>Reset</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default HandicapCalculatorsInline;
