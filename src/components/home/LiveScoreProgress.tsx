import { useEffect, useState } from "react";
import { Flag } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";

interface Props {
  matchId: string;
  creatorId: string;
  totalHoles: number;
  holePars: Record<string, number> | null | undefined;
  currentUserId?: string;
}

interface PlayerProgress {
  user_id: string;
  display_name: string;
  is_host: boolean;
  is_self: boolean;
  scores: Record<number, number>;
  holesPlayed: number;
  totalStrokes: number;
  parPlayed: number;
}

const LiveScoreProgress = ({
  matchId,
  creatorId,
  totalHoles,
  holePars,
  currentUserId,
}: Props) => {
  const [players, setPlayers] = useState<PlayerProgress[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const [{ data: parts, error: pErr }, { data: scores, error: sErr }] =
        await Promise.all([
          supabase
            .from("match_participants")
            .select("user_id, status")
            .eq("match_id", matchId)
            .eq("status", "active"),
          supabase
            .from("match_scores")
            .select("player_id, hole_number, strokes")
            .eq("match_id", matchId),
        ]);

      if (pErr || sErr) {
        if (!cancelled) setError("Couldn't load live scores");
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
          (profs ?? []).map((p: any) => [
            p.user_id,
            p.display_name || "Player",
          ]),
        );
      }

      const byPlayer = new Map<string, Record<number, number>>();
      (scores ?? []).forEach((s: any) => {
        if (!s.strokes) return;
        const m = byPlayer.get(s.player_id) ?? {};
        m[s.hole_number] = s.strokes;
        byPlayer.set(s.player_id, m);
      });

      if (cancelled) return;
      setPlayers(
        (parts ?? []).map((p: any) => {
          const sc = byPlayer.get(p.user_id) ?? {};
          const holesPlayed = Object.keys(sc).length;
          const totalStrokes = Object.values(sc).reduce(
            (sum, v) => sum + (v || 0),
            0,
          );
          const parPlayed = Object.keys(sc).reduce((sum, h) => {
            const par = holePars?.[h] ?? 4;
            return sum + par;
          }, 0);
          return {
            user_id: p.user_id,
            display_name: nameMap.get(p.user_id) || "Player",
            is_host: p.user_id === creatorId,
            is_self: p.user_id === currentUserId,
            scores: sc,
            holesPlayed,
            totalStrokes,
            parPlayed,
          };
        }),
      );
    };

    load();

    const channel = supabase
      .channel(`live-scores-${matchId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "match_scores",
          filter: `match_id=eq.${matchId}`,
        },
        () => load(),
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [matchId, creatorId, currentUserId, holePars]);

  if (error) {
    return <p className="text-xs text-destructive">{error}</p>;
  }

  if (!players) {
    return <Skeleton className="h-16 w-full" />;
  }

  if (players.length === 0) {
    return null;
  }

  const sorted = [...players].sort((a, b) => {
    if (a.holesPlayed !== b.holesPlayed) return b.holesPlayed - a.holesPlayed;
    const aDiff = a.totalStrokes - a.parPlayed;
    const bDiff = b.totalStrokes - b.parPlayed;
    return aDiff - bDiff;
  });

  const formatToPar = (p: PlayerProgress) => {
    if (p.holesPlayed === 0) return "—";
    const diff = p.totalStrokes - p.parPlayed;
    if (diff === 0) return "E";
    return diff > 0 ? `+${diff}` : `${diff}`;
  };

  return (
    <div className="space-y-2 rounded-xl border border-border bg-muted/30 p-3">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1">
          <Flag className="w-3 h-3" aria-hidden="true" />
          Live progress
        </p>
        <span className="text-[10px] text-muted-foreground">
          {totalHoles} holes
        </span>
      </div>
      <ul className="space-y-2">
        {sorted.map((p) => {
          const pct = Math.round((p.holesPlayed / totalHoles) * 100);
          const toPar = formatToPar(p);
          const toParColor =
            p.holesPlayed === 0
              ? "text-muted-foreground"
              : p.totalStrokes - p.parPlayed < 0
                ? "text-success"
                : p.totalStrokes - p.parPlayed > 0
                  ? "text-destructive"
                  : "text-foreground";
          return (
            <li key={p.user_id} className="space-y-1">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="truncate font-medium">
                  {p.display_name}
                  {p.is_self && (
                    <span className="ml-1 text-[10px] text-muted-foreground">
                      (you)
                    </span>
                  )}
                </span>
                <span className="flex items-center gap-2 shrink-0 tabular-nums">
                  <span className="text-muted-foreground">
                    {p.holesPlayed}/{totalHoles}
                  </span>
                  <span className={`font-semibold ${toParColor}`}>{toPar}</span>
                  {p.holesPlayed > 0 && (
                    <span className="text-muted-foreground">
                      · {p.totalStrokes}
                    </span>
                  )}
                </span>
              </div>
              <Progress value={pct} className="h-1.5" />
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default LiveScoreProgress;
