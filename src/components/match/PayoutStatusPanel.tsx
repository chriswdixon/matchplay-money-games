import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertTriangle, Clock, EyeOff, Wallet } from "lucide-react";

type Props = { matchId: string };

type ExpectedTx = {
  user_id: string;
  display_name: string;
  kind: "match_buyin" | "winning";
  amount: number;
};

type ActualTx = {
  user_id: string;
  transaction_type: string;
  amount: number;
  created_at: string;
};

export const PayoutStatusPanel = ({ matchId }: Props) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [matchRow, setMatchRow] = useState<{
    buy_in_amount: number;
    is_team_format: boolean | null;
    status: string;
  } | null>(null);
  const [resultRow, setResultRow] = useState<{
    winners: string[] | null;
    winner_id: string | null;
    finalized_at: string | null;
  } | null>(null);
  const [participants, setParticipants] = useState<{ user_id: string }[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [actuals, setActuals] = useState<ActualTx[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [{ data: m }, { data: r }, { data: p }, { data: txs }] = await Promise.all([
        supabase
          .from("matches")
          .select("buy_in_amount, is_team_format, status")
          .eq("id", matchId)
          .maybeSingle(),
        supabase
          .from("match_results")
          .select("winners, winner_id, finalized_at")
          .eq("match_id", matchId)
          .order("finalized_at", { ascending: false, nullsFirst: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("match_participants")
          .select("user_id")
          .eq("match_id", matchId)
          .eq("status", "active"),
        supabase
          .from("account_transactions")
          .select("user_id, transaction_type, amount, created_at")
          .eq("match_id", matchId),
      ]);

      let admin = false;
      if (user?.id) {
        const { data: roleRow } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .eq("role", "admin")
          .maybeSingle();
        admin = !!roleRow;
      }

      const userIds = new Set<string>();
      (p || []).forEach((row: any) => userIds.add(row.user_id));
      const winnerList: string[] =
        (r?.winners as string[] | null) ||
        (r?.winner_id ? [r.winner_id] : []);
      winnerList.forEach((u) => userIds.add(u));

      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, display_name")
        .in("user_id", Array.from(userIds));

      if (cancelled) return;
      setIsAdmin(admin);
      setMatchRow(m as any);
      setResultRow(r as any);
      setParticipants((p as any[]) || []);
      setActuals((txs as any[]) || []);
      const map: Record<string, string> = {};
      (profs || []).forEach((row: any) => {
        map[row.user_id] = row.display_name || row.user_id.slice(0, 8);
      });
      setProfiles(map);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [matchId, user?.id]);

  const expected: ExpectedTx[] = useMemo(() => {
    if (!matchRow) return [];
    const list: ExpectedTx[] = [];
    if (matchRow.buy_in_amount > 0) {
      participants.forEach((p) => {
        list.push({
          user_id: p.user_id,
          display_name: profiles[p.user_id] || p.user_id.slice(0, 8),
          kind: "match_buyin",
          amount: -matchRow.buy_in_amount,
        });
      });
    }
    const winners: string[] =
      (resultRow?.winners as string[] | null) ||
      (resultRow?.winner_id ? [resultRow.winner_id] : []);
    if (winners.length > 0 && matchRow.buy_in_amount > 0) {
      const pot = matchRow.buy_in_amount * participants.length;
      const payout = Math.floor(pot / winners.length);
      winners.forEach((w) => {
        list.push({
          user_id: w,
          display_name: profiles[w] || w.slice(0, 8),
          kind: "winning",
          amount: payout,
        });
      });
    }
    return list;
  }, [matchRow, resultRow, participants, profiles]);

  const lookupActual = (userId: string, kind: ExpectedTx["kind"]) =>
    actuals.find((a) => a.user_id === userId && a.transaction_type === kind);

  const getStatus = (e: ExpectedTx) => {
    const found = lookupActual(e.user_id, e.kind);
    if (found) return "credited" as const;
    // Visibility: non-admins only see their own actuals.
    const canSee = isAdmin || e.user_id === user?.id;
    if (!canSee) return "hidden" as const;
    if (!resultRow?.finalized_at && e.kind === "winning") return "pending" as const;
    if (matchRow?.status !== "completed" && e.kind === "match_buyin") return "pending" as const;
    return "missing" as const;
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Wallet className="h-4 w-4" /> Payout status
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">Loading…</CardContent>
      </Card>
    );
  }

  if (!matchRow || matchRow.buy_in_amount === 0) {
    return null;
  }

  const winners: string[] =
    (resultRow?.winners as string[] | null) ||
    (resultRow?.winner_id ? [resultRow.winner_id] : []);
  const pot = matchRow.buy_in_amount * participants.length;
  const allCredited =
    expected.length > 0 &&
    expected.every((e) => getStatus(e) === "credited" || getStatus(e) === "hidden");
  const anyMissing = expected.some((e) => getStatus(e) === "missing");

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between gap-2 text-base">
          <span className="flex items-center gap-2">
            <Wallet className="h-4 w-4" /> Payout status
          </span>
          {anyMissing ? (
            <Badge variant="destructive" className="gap-1">
              <AlertTriangle className="h-3 w-3" /> Action needed
            </Badge>
          ) : allCredited && resultRow?.finalized_at ? (
            <Badge className="gap-1 bg-emerald-600 hover:bg-emerald-600">
              <CheckCircle2 className="h-3 w-3" /> Settled
            </Badge>
          ) : (
            <Badge variant="secondary" className="gap-1">
              <Clock className="h-3 w-3" /> Pending
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
          <div>
            <div className="font-semibold text-foreground">${pot}</div>
            <div>Pot</div>
          </div>
          <div>
            <div className="font-semibold text-foreground">{participants.length}</div>
            <div>Active players</div>
          </div>
          <div>
            <div className="font-semibold text-foreground">{winners.length || "—"}</div>
            <div>Winner(s)</div>
          </div>
        </div>

        <div className="rounded-md border divide-y" role="table" aria-label="Expected transactions">
          <div
            className="grid grid-cols-12 px-3 py-2 text-xs font-medium text-muted-foreground"
            role="row"
          >
            <div className="col-span-4">Player</div>
            <div className="col-span-3">Type</div>
            <div className="col-span-2 text-right">Amount</div>
            <div className="col-span-3 text-right">Status</div>
          </div>
          {expected.length === 0 && (
            <div className="px-3 py-4 text-sm text-muted-foreground">
              Match not yet finalized — expected transactions will appear once a winner is set.
            </div>
          )}
          {expected.map((e, idx) => {
            const status = getStatus(e);
            return (
              <div
                key={`${e.user_id}-${e.kind}-${idx}`}
                className="grid grid-cols-12 items-center px-3 py-2 text-sm"
                role="row"
              >
                <div className="col-span-4 truncate" title={e.display_name}>
                  {e.display_name}
                  {e.user_id === user?.id && (
                    <span className="ml-1 text-xs text-muted-foreground">(you)</span>
                  )}
                </div>
                <div className="col-span-3 text-muted-foreground capitalize">
                  {e.kind === "match_buyin" ? "Buy-in" : "Winnings"}
                </div>
                <div
                  className={`col-span-2 text-right ${
                    e.amount < 0 ? "text-destructive" : "text-emerald-600"
                  }`}
                >
                  {e.amount < 0 ? `-$${Math.abs(e.amount)}` : `+$${e.amount}`}
                </div>
                <div className="col-span-3 flex justify-end">
                  {status === "credited" && (
                    <Badge className="gap-1 bg-emerald-600 hover:bg-emerald-600">
                      <CheckCircle2 className="h-3 w-3" /> Credited
                    </Badge>
                  )}
                  {status === "pending" && (
                    <Badge variant="secondary" className="gap-1">
                      <Clock className="h-3 w-3" /> Pending
                    </Badge>
                  )}
                  {status === "missing" && (
                    <Badge variant="destructive" className="gap-1">
                      <AlertTriangle className="h-3 w-3" /> Missing
                    </Badge>
                  )}
                  {status === "hidden" && (
                    <Badge variant="outline" className="gap-1">
                      <EyeOff className="h-3 w-3" /> Not visible
                    </Badge>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {anyMissing && (
          <p className="text-xs text-muted-foreground">
            Missing transactions are auto-retried every 15 minutes by the reconciliation job and
            flagged in the admin audit alerts.
          </p>
        )}
        {!isAdmin && expected.some((e) => getStatus(e) === "hidden") && (
          <p className="text-xs text-muted-foreground">
            You only see your own transactions. Other players' rows are validated server-side.
          </p>
        )}
      </CardContent>
    </Card>
  );
};

export default PayoutStatusPanel;
