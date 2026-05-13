import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Wallet, Download, Search } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface TxnRow {
  id: string;
  user_id: string;
  account_id: string;
  amount: number;
  transaction_type: string;
  match_id: string | null;
  description: string;
  metadata: any;
  created_at: string;
  user_name?: string;
}

const TYPE_LABELS: Record<string, string> = {
  winning: "Winning",
  match_buyin: "Match buy-in",
  match_cancellation: "Cancellation refund",
  subscription_charge: "Subscription",
  coupon: "Coupon",
  payout: "Payout",
  double_down: "Double down",
};

const TYPE_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  winning: "default",
  match_buyin: "secondary",
  match_cancellation: "outline",
  subscription_charge: "secondary",
  coupon: "outline",
  payout: "destructive",
  double_down: "secondary",
};

export function FundsAuditLog() {
  const [rows, setRows] = useState<TxnRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [days, setDays] = useState<string>("30");

  const fetchRows = async () => {
    setLoading(true);
    try {
      let q = supabase
        .from("account_transactions")
        .select(
          "id, user_id, account_id, amount, transaction_type, match_id, description, metadata, created_at"
        )
        .order("created_at", { ascending: false })
        .limit(500);

      if (days !== "all") {
        const since = new Date(Date.now() - Number(days) * 86400000).toISOString();
        q = q.gte("created_at", since);
      }
      if (typeFilter !== "all") {
        q = q.eq("transaction_type", typeFilter as any);
      }

      const { data, error } = await q;
      if (error) throw error;

      const userIds = Array.from(new Set((data || []).map((r) => r.user_id)));
      let nameMap: Record<string, string> = {};
      if (userIds.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("user_id, display_name")
          .in("user_id", userIds);
        nameMap = Object.fromEntries(
          (profs || []).map((p: any) => [p.user_id, p.display_name || "Unknown"])
        );
      }

      setRows(
        (data || []).map((r: any) => ({
          ...r,
          user_name: nameMap[r.user_id] || r.user_id.slice(0, 8),
        }))
      );
    } catch (e: any) {
      console.error("Funds audit fetch error", e);
      toast({
        title: "Failed to load funds audit",
        description: e.message || "Please try again",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typeFilter, days]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter(
      (r) =>
        r.user_name?.toLowerCase().includes(term) ||
        r.description?.toLowerCase().includes(term) ||
        r.match_id?.toLowerCase().includes(term) ||
        r.user_id.toLowerCase().includes(term)
    );
  }, [rows, search]);

  const totals = useMemo(() => {
    const t: Record<string, { count: number; sum: number }> = {};
    let net = 0;
    for (const r of filtered) {
      const a = Number(r.amount) || 0;
      net += a;
      t[r.transaction_type] = t[r.transaction_type] || { count: 0, sum: 0 };
      t[r.transaction_type].count += 1;
      t[r.transaction_type].sum += a;
    }
    return { net, byType: t };
  }, [filtered]);

  const fmtMoney = (cents: number) => {
    const dollars = cents / 100;
    const sign = dollars < 0 ? "-" : "";
    return `${sign}$${Math.abs(dollars).toFixed(2)}`;
  };

  const exportCsv = () => {
    const header = ["created_at", "user", "user_id", "type", "amount_cents", "match_id", "description"];
    const lines = filtered.map((r) =>
      [
        r.created_at,
        JSON.stringify(r.user_name || ""),
        r.user_id,
        r.transaction_type,
        r.amount,
        r.match_id || "",
        JSON.stringify(r.description || ""),
      ].join(",")
    );
    const csv = [header.join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `funds-audit-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-primary rounded-lg">
              <Wallet className="w-5 h-5 text-primary-foreground" aria-hidden="true" />
            </div>
            <div>
              <CardTitle>Funds Audit Trail</CardTitle>
              <CardDescription>
                All player-account movements: buy-ins, winnings, refunds, cancellation fees, coupons, double-downs.
              </CardDescription>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={!filtered.length}>
            <Download className="w-4 h-4 mr-2" aria-hidden="true" />
            Export CSV
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-3 items-center">
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {Object.entries(TYPE_LABELS).map(([v, l]) => (
                <SelectItem key={v} value={v}>
                  {l}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={days} onValueChange={setDays}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
              <SelectItem value="365">Last year</SelectItem>
              <SelectItem value="all">All time</SelectItem>
            </SelectContent>
          </Select>

          <div className="relative flex-1 min-w-[220px]">
            <Search
              className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search user, description, match…"
              className="pl-8"
              aria-label="Search transactions"
            />
          </div>
        </div>

        {/* Summary chips */}
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" className="text-xs">
            {filtered.length} entries · Net {fmtMoney(totals.net)}
          </Badge>
          {Object.entries(totals.byType).map(([t, v]) => (
            <Badge key={t} variant={TYPE_VARIANTS[t] || "secondary"} className="text-xs">
              {TYPE_LABELS[t] || t}: {v.count} · {fmtMoney(v.sum)}
            </Badge>
          ))}
        </div>

        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Match</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    Loading…
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    No transactions for the selected filters.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="whitespace-nowrap text-xs">
                      {new Date(r.created_at).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-sm">
                      <div className="font-medium">{r.user_name}</div>
                      <div className="text-[11px] text-muted-foreground font-mono">
                        {r.user_id.slice(0, 8)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={TYPE_VARIANTS[r.transaction_type] || "secondary"} className="text-xs">
                        {TYPE_LABELS[r.transaction_type] || r.transaction_type}
                      </Badge>
                    </TableCell>
                    <TableCell
                      className={`text-right font-mono text-sm ${
                        Number(r.amount) < 0 ? "text-destructive" : "text-success"
                      }`}
                    >
                      {fmtMoney(Number(r.amount))}
                    </TableCell>
                    <TableCell className="text-sm max-w-[280px] truncate" title={r.description}>
                      {r.description}
                    </TableCell>
                    <TableCell className="text-xs font-mono text-muted-foreground">
                      {r.match_id ? r.match_id.slice(0, 8) : "—"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

export default FundsAuditLog;
