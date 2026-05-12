import { useMemo } from "react";
import { Filter, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";

export type TeeTimeWindow = "any" | "today" | "tomorrow" | "week" | "weekend";
export type FormatFilter = "any" | "match" | "team" | "stroke";
export type SizeFilter = "any" | "2" | "4" | "5+";
export type SortKey = "distance" | "soonest" | "fullest" | "lowest_buyin";

export interface MatchSearchFilters {
  teeTime: TeeTimeWindow;
  format: FormatFilter;
  size: SizeFilter;
  hcpMin: number;
  hcpMax: number;
  sort: SortKey;
}

export const DEFAULT_FILTERS: MatchSearchFilters = {
  teeTime: "any",
  format: "any",
  size: "any",
  hcpMin: 0,
  hcpMax: 36,
  sort: "distance",
};

export const isFilterActive = (f: MatchSearchFilters) =>
  f.teeTime !== "any" ||
  f.format !== "any" ||
  f.size !== "any" ||
  f.hcpMin > 0 ||
  f.hcpMax < 36 ||
  f.sort !== "distance";

interface MatchLike {
  scheduled_time: string;
  format: string;
  max_participants: number;
  is_team_format?: boolean;
  handicap_min?: number | null;
  handicap_max?: number | null;
  participant_count?: number;
  buy_in_amount: number;
}

const startOfDay = (d: Date) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

const inWindow = (whenISO: string, w: TeeTimeWindow) => {
  if (w === "any") return true;
  const t = new Date(whenISO).getTime();
  const now = Date.now();
  const today0 = startOfDay(new Date()).getTime();
  const tomorrow0 = today0 + 24 * 60 * 60 * 1000;
  const day2 = today0 + 2 * 24 * 60 * 60 * 1000;
  const day7 = today0 + 7 * 24 * 60 * 60 * 1000;
  if (t < now) return false;
  if (w === "today") return t >= today0 && t < tomorrow0;
  if (w === "tomorrow") return t >= tomorrow0 && t < day2;
  if (w === "week") return t < day7;
  if (w === "weekend") {
    // next Sat 00:00 → Mon 00:00
    const d = new Date();
    const dow = d.getDay(); // 0 Sun..6 Sat
    const daysToSat = (6 - dow + 7) % 7;
    const sat0 = startOfDay(new Date(today0 + daysToSat * 86400000)).getTime();
    const mon0 = sat0 + 2 * 86400000;
    return t >= sat0 && t < mon0;
  }
  return true;
};

const matchesFormat = (m: MatchLike, f: FormatFilter) => {
  if (f === "any") return true;
  if (f === "team") return !!m.is_team_format;
  if (f === "match") return !m.is_team_format && m.max_participants === 2;
  if (f === "stroke")
    return !m.is_team_format && (m.max_participants > 2 || m.format === "stroke");
  return true;
};

const matchesSize = (m: MatchLike, s: SizeFilter) => {
  if (s === "any") return true;
  if (s === "2") return m.max_participants === 2;
  if (s === "4") return m.max_participants === 4;
  if (s === "5+") return m.max_participants >= 5;
  return true;
};

const matchesHandicap = (m: MatchLike, lo: number, hi: number) => {
  // If a match has its own handicap range, require overlap with the user filter.
  const mLo = m.handicap_min ?? 0;
  const mHi = m.handicap_max ?? 36;
  return mHi >= lo && mLo <= hi;
};

export function applyMatchFilters<T extends MatchLike>(
  list: T[],
  f: MatchSearchFilters,
): T[] {
  return list.filter(
    (m) =>
      inWindow(m.scheduled_time, f.teeTime) &&
      matchesFormat(m, f.format) &&
      matchesSize(m, f.size) &&
      matchesHandicap(m, f.hcpMin, f.hcpMax),
  );
}

export function compareBySort<T extends MatchLike>(
  a: T,
  b: T,
  sort: SortKey,
): number {
  if (sort === "soonest") {
    return (
      new Date(a.scheduled_time).getTime() -
      new Date(b.scheduled_time).getTime()
    );
  }
  if (sort === "fullest") {
    const af = (a.participant_count || 0) / Math.max(1, a.max_participants);
    const bf = (b.participant_count || 0) / Math.max(1, b.max_participants);
    return bf - af;
  }
  if (sort === "lowest_buyin") {
    return a.buy_in_amount - b.buy_in_amount;
  }
  return 0;
}

interface Props {
  value: MatchSearchFilters;
  onChange: (next: MatchSearchFilters) => void;
}

const MatchSearchFiltersBar = ({ value, onChange }: Props) => {
  const active = useMemo(() => isFilterActive(value), [value]);
  const set = <K extends keyof MatchSearchFilters>(
    k: K,
    v: MatchSearchFilters[K],
  ) => onChange({ ...value, [k]: v });

  return (
    <div className="flex items-center gap-2">
      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 gap-1.5"
            aria-label="Filter matches"
          >
            <Filter className="w-3.5 h-3.5" />
            Filters
            {active && (
              <span className="inline-flex items-center justify-center text-[10px] font-bold rounded-full bg-primary text-primary-foreground w-4 h-4">
                ●
              </span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72 space-y-3" align="start">
          <div className="space-y-1.5">
            <Label className="text-xs">Tee time</Label>
            <Select
              value={value.teeTime}
              onValueChange={(v) => set("teeTime", v as TeeTimeWindow)}
            >
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Any time</SelectItem>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="tomorrow">Tomorrow</SelectItem>
                <SelectItem value="weekend">This weekend</SelectItem>
                <SelectItem value="week">Next 7 days</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Format</Label>
            <Select
              value={value.format}
              onValueChange={(v) => set("format", v as FormatFilter)}
            >
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Any format</SelectItem>
                <SelectItem value="match">Match Play (1v1)</SelectItem>
                <SelectItem value="team">Team (2v2 / 4v4)</SelectItem>
                <SelectItem value="stroke">Stroke Play</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Group size</Label>
            <Select
              value={value.size}
              onValueChange={(v) => set("size", v as SizeFilter)}
            >
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Any size</SelectItem>
                <SelectItem value="2">2 players</SelectItem>
                <SelectItem value="4">4 players</SelectItem>
                <SelectItem value="5+">5+ players</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Handicap range</Label>
              <span className="text-xs text-muted-foreground tabular-nums">
                {value.hcpMin}–{value.hcpMax}
              </span>
            </div>
            <Slider
              value={[value.hcpMin, value.hcpMax]}
              onValueChange={(v) =>
                onChange({ ...value, hcpMin: v[0], hcpMax: v[1] })
              }
              min={0}
              max={36}
              step={1}
              minStepsBetweenThumbs={1}
              aria-label="Handicap range"
            />
          </div>

          {active && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full gap-1.5"
              onClick={() => onChange(DEFAULT_FILTERS)}
            >
              <X className="w-3.5 h-3.5" /> Reset filters
            </Button>
          )}
        </PopoverContent>
      </Popover>

      <Select
        value={value.sort}
        onValueChange={(v) => set("sort", v as SortKey)}
      >
        <SelectTrigger className="h-9 w-[150px]" aria-label="Sort matches">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="distance">Nearest</SelectItem>
          <SelectItem value="soonest">Soonest tee time</SelectItem>
          <SelectItem value="fullest">Most players joined</SelectItem>
          <SelectItem value="lowest_buyin">Lowest buy-in</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
};

export default MatchSearchFiltersBar;
