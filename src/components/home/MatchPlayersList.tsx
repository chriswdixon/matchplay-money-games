import { useEffect, useState } from "react";
import { Crown, User as UserIcon, Check, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";

interface PlayerRow {
  user_id: string;
  display_name: string;
  status: string;
  joined_at: string;
  team_number: number | null;
  is_host: boolean;
}

interface Props {
  matchId: string;
  creatorId: string;
  maxParticipants: number;
}

const MatchPlayersList = ({ matchId, creatorId, maxParticipants }: Props) => {
  const [players, setPlayers] = useState<PlayerRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: parts, error: pErr } = await supabase
        .from("match_participants")
        .select("user_id, status, joined_at, team_number")
        .eq("match_id", matchId)
        .order("joined_at", { ascending: true });

      if (pErr) {
        if (!cancelled) setError("Couldn't load players");
        return;
      }

      const ids = (parts ?? []).map((p) => p.user_id);
      let nameMap = new Map<string, string>();
      if (ids.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("user_id, display_name")
          .in("user_id", ids);
        nameMap = new Map(
          (profs ?? []).map((p: any) => [p.user_id, p.display_name || "Player"]),
        );
      }

      if (cancelled) return;
      setPlayers(
        (parts ?? []).map((p: any) => ({
          user_id: p.user_id,
          display_name: nameMap.get(p.user_id) || "Player",
          status: p.status,
          joined_at: p.joined_at,
          team_number: p.team_number,
          is_host: p.user_id === creatorId,
        })),
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [matchId, creatorId]);

  if (error) {
    return <p className="text-xs text-destructive">{error}</p>;
  }

  if (!players) {
    return (
      <div className="space-y-1.5">
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-5 w-2/3" />
      </div>
    );
  }

  const active = players.filter((p) => p.status === "active");
  const openSeats = Math.max(0, maxParticipants - active.length);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Players ({active.length}/{maxParticipants})
        </p>
      </div>
      <ul className="space-y-1">
        {players.map((p) => {
          const isActive = p.status === "active";
          return (
            <li
              key={p.user_id}
              className="flex items-center justify-between gap-2 text-xs"
            >
              <span className="flex items-center gap-1.5 min-w-0">
                {p.is_host ? (
                  <Crown
                    className="w-3.5 h-3.5 text-warning shrink-0"
                    aria-label="Host"
                  />
                ) : (
                  <UserIcon
                    className="w-3.5 h-3.5 text-muted-foreground shrink-0"
                    aria-hidden="true"
                  />
                )}
                <span className="truncate">{p.display_name}</span>
                {p.team_number != null && (
                  <span className="text-[10px] text-muted-foreground shrink-0">
                    · Team {p.team_number}
                  </span>
                )}
              </span>
              <span className="flex items-center gap-1 shrink-0">
                <span
                  className={`inline-flex items-center gap-0.5 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-full ${
                    p.is_host
                      ? "bg-warning/15 text-warning"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {p.is_host ? "Host" : "Player"}
                </span>
                {isActive ? (
                  <Check
                    className="w-3 h-3 text-success"
                    aria-label="Joined"
                  />
                ) : (
                  <Clock
                    className="w-3 h-3 text-muted-foreground"
                    aria-label={p.status}
                  />
                )}
              </span>
            </li>
          );
        })}
        {Array.from({ length: openSeats }).map((_, i) => (
          <li
            key={`open-${i}`}
            className="flex items-center gap-1.5 text-xs text-muted-foreground/70 italic"
          >
            <UserIcon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            Open seat
          </li>
        ))}
      </ul>
    </div>
  );
};

export default MatchPlayersList;
