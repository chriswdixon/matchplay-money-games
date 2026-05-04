import { useEffect, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Calendar,
  MapPin,
  Users,
  DollarSign,
  Trophy,
  ScrollText,
  Clock,
} from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import CourseImage from "@/components/CourseImage";
import { useAdminRole } from "@/hooks/useAdminRole";
import { AuditLog } from "@/components/admin/AuditLog";

export interface MatchDetailsInfo {
  id: string;
  course_name: string;
  location?: string;
  address?: string;
  scheduled_time: string;
  format: string;
  holes: number;
  buy_in_amount: number;
  max_participants: number;
  participant_count?: number;
  is_team_format?: boolean;
  pin?: string | null;
  user_joined?: boolean;
  image_url?: string | null;
}

interface Participant {
  user_id: string;
  team_number?: number | null;
  display_name?: string | null;
  profile_picture_url?: string | null;
}

interface MatchDetailsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  match: MatchDetailsInfo | null;
  onJoin?: (match: MatchDetailsInfo) => void;
  joining?: boolean;
}

const formatLabel = (f: string) => {
  const map: Record<string, string> = {
    "stroke-play": "Stroke Play",
    "match-play": "Match Play",
    "best-ball": "Best Ball",
    scramble: "Scramble",
  };
  return map[f] || f;
};

const MatchDetailsSheet = ({
  open,
  onOpenChange,
  match,
  onJoin,
  joining = false,
}: MatchDetailsSheetProps) => {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(false);
  const { isAdmin } = useAdminRole();

  useEffect(() => {
    if (!open || !match) return;

    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const { data: parts } = await supabase
          .from("match_participants")
          .select("user_id, team_number")
          .eq("match_id", match.id);

        if (!parts || parts.length === 0) {
          if (!cancelled) setParticipants([]);
          return;
        }

        const userIds = parts.map((p) => p.user_id);
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, display_name, profile_picture_url")
          .in("user_id", userIds);

        const profileMap = new Map(
          (profiles || []).map((p) => [p.user_id, p]),
        );

        if (!cancelled) {
          setParticipants(
            parts.map((p) => ({
              user_id: p.user_id,
              team_number: p.team_number,
              display_name: profileMap.get(p.user_id)?.display_name,
              profile_picture_url: profileMap.get(p.user_id)?.profile_picture_url,
            })),
          );
        }
      } catch (e) {
        console.error("Failed to load participants", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [open, match]);

  if (!match) return null;

  const totalPot = (match.buy_in_amount || 0) * match.max_participants;
  const isFull = (match.participant_count || 0) >= match.max_participants;
  const tee = new Date(match.scheduled_time);
  const initialsOf = (name?: string | null) =>
    name
      ?.split(" ")
      .map((p) => p[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="rounded-t-3xl p-0 max-h-[92vh] overflow-y-auto"
      >
        {/* Hero image */}
        <div className="relative h-44 w-full">
          <CourseImage
            src={match.image_url}
            alt={match.course_name}
            containerClassName="h-44"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
          <div className="absolute bottom-3 left-4 right-4 text-primary-foreground">
            <Badge className="bg-primary text-primary-foreground mb-1">
              {formatLabel(match.format)}
            </Badge>
            <h2 className="text-xl font-bold leading-tight">{match.course_name}</h2>
            {match.location && (
              <p className="text-xs opacity-90 flex items-center gap-1 mt-0.5">
                <MapPin className="w-3 h-3" aria-hidden="true" />
                {match.location}
              </p>
            )}
          </div>
        </div>

        <div className="p-5 space-y-5">
          <SheetHeader className="sr-only">
            <SheetTitle>{match.course_name} match details</SheetTitle>
            <SheetDescription>
              Tee time, rules, entry amount and joined players for this match.
            </SheetDescription>
          </SheetHeader>

          {/* Quick stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border p-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Calendar className="w-3.5 h-3.5" aria-hidden="true" /> Tee time
              </div>
              <div className="text-sm font-semibold mt-1">
                {format(tee, "EEE, MMM d")}
              </div>
              <div className="text-xs text-muted-foreground">
                {format(tee, "h:mm a")}
              </div>
            </div>
            <div className="rounded-xl border p-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Trophy className="w-3.5 h-3.5" aria-hidden="true" /> Holes
              </div>
              <div className="text-sm font-semibold mt-1">{match.holes} holes</div>
              <div className="text-xs text-muted-foreground">
                {formatLabel(match.format)}
              </div>
            </div>
            <div className="rounded-xl border p-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <DollarSign className="w-3.5 h-3.5" aria-hidden="true" /> Entry
              </div>
              <div className="text-sm font-semibold mt-1">
                ${match.buy_in_amount}
              </div>
              <div className="text-xs text-muted-foreground">
                Pot ${totalPot}
              </div>
            </div>
            <div className="rounded-xl border p-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Users className="w-3.5 h-3.5" aria-hidden="true" /> Players
              </div>
              <div className="text-sm font-semibold mt-1">
                {match.participant_count || 0}/{match.max_participants}
              </div>
              <div className="text-xs text-muted-foreground">
                {isFull ? "Full" : "Spots open"}
              </div>
            </div>
          </div>

          {/* Course info */}
          {match.address && (
            <div className="rounded-xl bg-muted/40 p-3 text-sm">
              <div className="flex items-center gap-2 font-semibold mb-1">
                <MapPin className="w-4 h-4 text-primary" aria-hidden="true" />
                Course
              </div>
              <p className="text-muted-foreground">{match.address}</p>
            </div>
          )}

          {/* Rules */}
          <div className="rounded-xl border p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <ScrollText className="w-4 h-4 text-primary" aria-hidden="true" />
              Match rules
            </div>
            <ul className="text-xs text-muted-foreground space-y-1 list-disc pl-4">
              <li>Skill-based competitive play — not gambling.</li>
              <li>Complete every hole to be eligible for the payout.</li>
              <li>Leaving after start may forfeit your entry.</li>
              <li>
                Payout posts within ~30 minutes of the last player finalizing.
              </li>
            </ul>
          </div>

          {/* Joined players */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold">Who's joined</h3>
              <span className="text-xs text-muted-foreground">
                {participants.length}/{match.max_participants}
              </span>
            </div>
            <div className="space-y-2">
              {loading ? (
                Array.from({ length: 2 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full rounded-xl" />
                ))
              ) : participants.length === 0 ? (
                <p className="text-xs text-muted-foreground py-3 text-center">
                  No one has joined yet — be the first!
                </p>
              ) : (
                participants.map((p) => (
                  <div
                    key={p.user_id}
                    className="flex items-center gap-3 bg-muted/40 rounded-xl p-2.5"
                  >
                    <Avatar className="w-9 h-9">
                      {p.profile_picture_url && (
                        <AvatarImage src={p.profile_picture_url} alt="" />
                      )}
                      <AvatarFallback className="text-xs bg-primary/15 text-primary font-semibold">
                        {initialsOf(p.display_name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">
                        {p.display_name || "Player"}
                      </div>
                      {p.team_number && (
                        <div className="text-[10px] text-muted-foreground">
                          Team {p.team_number}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <Separator />

          {/* Admin-only per-match audit log */}
          {isAdmin && match?.id && (
            <div className="space-y-2">
              <AuditLog matchId={match.id} />
            </div>
          )}

          {/* Footer CTA */}
          <div className="flex items-center gap-3 pb-2">
            <div className="flex-1">
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="w-3 h-3" aria-hidden="true" />
                Starts {format(tee, "MMM d, h:mm a")}
              </div>
              <div className="text-lg font-bold">${match.buy_in_amount} entry</div>
            </div>
            {onJoin && !match.user_joined && (
              <Button
                disabled={isFull || joining}
                onClick={() => onJoin(match)}
                className="rounded-full h-12 px-7 font-bold bg-primary text-primary-foreground shadow-accent"
              >
                {isFull ? "FULL" : joining ? "Joining..." : "JOIN"}
              </Button>
            )}
            {match.user_joined && (
              <Badge className="bg-primary/15 text-primary px-3 py-2">
                You're in
              </Badge>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default MatchDetailsSheet;
