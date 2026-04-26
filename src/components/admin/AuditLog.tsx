import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { ShieldCheck, Activity, AlertTriangle } from "lucide-react";

type Category = "score" | "transaction" | "payout" | "dispute" | "admin_override";

interface AuditEntry {
  id: string;
  created_at: string;
  category: Category;
  event_type: string;
  match_id: string | null;
  user_id: string | null;
  actor_id: string | null;
  summary: string;
  payload: Record<string, unknown>;
}

interface AuditLogProps {
  /** When provided, scopes the log to a single match. */
  matchId?: string;
  /** Defaults to 100 (per-match) or 200 (global). */
  pageSize?: number;
}

const categoryColor: Record<Category, string> = {
  score: "bg-blue-500/15 text-blue-600 border-blue-500/30",
  transaction: "bg-green-500/15 text-green-600 border-green-500/30",
  payout: "bg-purple-500/15 text-purple-600 border-purple-500/30",
  dispute: "bg-orange-500/15 text-orange-600 border-orange-500/30",
  admin_override: "bg-red-500/15 text-red-600 border-red-500/30",
};

export function AuditLog({ matchId, pageSize }: AuditLogProps) {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Category | "all">("all");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      const limit = pageSize ?? (matchId ? 100 : 200);
      let query = supabase
        .from("audit_log" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (matchId) query = query.eq("match_id", matchId);
      const { data, error } = await query;
      if (cancelled) return;
      if (error) {
        setError(error.message);
        setEntries([]);
      } else {
        setEntries((data ?? []) as unknown as AuditEntry[]);
      }
      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [matchId, pageSize]);

  const filtered = entries.filter((e) => {
    if (filter !== "all" && e.category !== filter) return false;
    if (!search) return true;
    const haystack = `${e.summary} ${e.event_type} ${JSON.stringify(e.payload)}`.toLowerCase();
    return haystack.includes(search.toLowerCase());
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-primary" />
          {matchId ? "Match Audit Log" : "Audit Log"}
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Reconciliation trail for scoring, transactions, payouts and admin overrides.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-2">
          <Input
            placeholder="Search summary, event or payload..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1"
          />
          <Select value={filter} onValueChange={(v) => setFilter(v as Category | "all")}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              <SelectItem value="score">Score</SelectItem>
              <SelectItem value="transaction">Transaction</SelectItem>
              <SelectItem value="payout">Payout</SelectItem>
              <SelectItem value="dispute">Dispute</SelectItem>
              <SelectItem value="admin_override">Admin override</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : error ? (
          <div className="flex items-center gap-2 text-sm text-destructive">
            <AlertTriangle className="w-4 h-4" /> {error}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-8 flex flex-col items-center gap-2">
            <Activity className="w-6 h-6 opacity-40" />
            No audit entries match the current filters.
          </div>
        ) : (
          <ScrollArea className="h-[60vh] pr-2">
            <ul className="space-y-2">
              {filtered.map((e) => (
                <li
                  key={e.id}
                  className="border rounded-lg p-3 bg-card hover:bg-accent/30 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className={categoryColor[e.category]}>
                        {e.category}
                      </Badge>
                      <code className="text-xs font-mono text-muted-foreground">
                        {e.event_type}
                      </code>
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {format(new Date(e.created_at), "MMM d, HH:mm:ss")}
                    </span>
                  </div>
                  <p className="text-sm font-medium">{e.summary}</p>
                  <div className="mt-1 text-xs text-muted-foreground space-x-3">
                    {e.match_id && <span>match: <code>{e.match_id.slice(0, 8)}</code></span>}
                    {e.user_id && <span>user: <code>{e.user_id.slice(0, 8)}</code></span>}
                    {e.actor_id && <span>actor: <code>{e.actor_id.slice(0, 8)}</code></span>}
                  </div>
                  {e.payload && Object.keys(e.payload).length > 0 && (
                    <details className="mt-2">
                      <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                        Payload
                      </summary>
                      <pre className="mt-1 text-[11px] bg-muted/50 rounded p-2 overflow-x-auto">
                        {JSON.stringify(e.payload, null, 2)}
                      </pre>
                    </details>
                  )}
                </li>
              ))}
            </ul>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}

export default AuditLog;
