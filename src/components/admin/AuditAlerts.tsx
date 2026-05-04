import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

interface AuditAlert {
  id: string;
  created_at: string;
  check_run_at: string;
  source_table: string;
  source_row_id: string | null;
  match_id: string | null;
  expected_event: string;
  details: Record<string, unknown>;
  severity: "warning" | "error" | string;
  status: "open" | "resolved" | string;
  resolved_at: string | null;
  resolution_note: string | null;
}

type StatusFilter = "open" | "resolved" | "all";

const severityClass: Record<string, string> = {
  error: "bg-red-500/15 text-red-600 border-red-500/30",
  warning: "bg-orange-500/15 text-orange-600 border-orange-500/30",
};

export function AuditAlerts() {
  const [alerts, setAlerts] = useState<AuditAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [filter, setFilter] = useState<StatusFilter>("open");

  const load = useCallback(async () => {
    setLoading(true);
    let q = supabase
      .from("audit_log_alerts" as any)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (filter !== "all") q = q.eq("status", filter);
    const { data, error } = await q;
    if (error) {
      toast.error(`Failed to load alerts: ${error.message}`);
      setAlerts([]);
    } else {
      setAlerts((data ?? []) as unknown as AuditAlert[]);
    }
    setLoading(false);
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  const runReconciliation = async () => {
    setRunning(true);
    const { data, error } = await supabase.rpc("reconcile_audit_log" as any, {
      p_lookback_hours: 24,
    });
    setRunning(false);
    if (error) {
      toast.error(`Reconciliation failed: ${error.message}`);
      return;
    }
    const total = (data as any)?.total_alerts_created ?? 0;
    toast.success(
      total === 0
        ? "Audit reconciliation complete — no discrepancies found"
        : `Audit reconciliation found ${total} new alert(s)`,
    );
    load();
  };

  const resolveAlert = async (id: string) => {
    const { error } = await supabase
      .from("audit_log_alerts" as any)
      .update({
        status: "resolved",
        resolved_at: new Date().toISOString(),
        resolution_note: "Manually resolved by admin",
      })
      .eq("id", id);
    if (error) {
      toast.error(`Could not resolve: ${error.message}`);
      return;
    }
    toast.success("Alert resolved");
    load();
  };

  const openCount = alerts.filter((a) => a.status === "open").length;

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5" />
            Audit Reconciliation Alerts
            {openCount > 0 && (
              <Badge variant="destructive" className="ml-2">
                {openCount} open
              </Badge>
            )}
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Daily background job compares source tables against{" "}
            <code className="text-xs">audit_log</code>. Anything missing shows up here.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            Refresh
          </Button>
          <Button size="sm" onClick={runReconciliation} disabled={running}>
            {running ? (
            ) : (
            )}
            Run now
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs value={filter} onValueChange={(v) => setFilter(v as StatusFilter)}>
          <TabsList>
            <TabsTrigger value="open">Open</TabsTrigger>
            <TabsTrigger value="resolved">Resolved</TabsTrigger>
            <TabsTrigger value="all">All</TabsTrigger>
          </TabsList>
        </Tabs>

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : alerts.length === 0 ? (
          <div className="flex items-center gap-2 rounded-md border border-dashed p-6 text-sm text-muted-foreground justify-center">
            <CheckCircle2 className="h-4 w-4 text-primary" />
            No alerts to show.
          </div>
        ) : (
          <ScrollArea className="h-[420px] pr-2">
            <ul className="space-y-2">
              {alerts.map((alert) => (
                <li
                  key={alert.id}
                  className="rounded-md border p-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        variant="outline"
                        className={severityClass[alert.severity] ?? ""}
                      >
                        <AlertTriangle className="h-3 w-3 mr-1" />
                        {alert.severity}
                      </Badge>
                      <Badge variant="secondary">{alert.source_table}</Badge>
                      <code className="text-xs text-muted-foreground">
                        missing: {alert.expected_event}
                      </code>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Detected {format(new Date(alert.created_at), "MMM d, yyyy HH:mm")}
                      {alert.match_id ? ` · match ${alert.match_id.slice(0, 8)}…` : ""}
                      {alert.source_row_id ? ` · row ${alert.source_row_id.slice(0, 8)}…` : ""}
                    </p>
                    <details className="text-xs">
                      <summary className="cursor-pointer text-muted-foreground">
                        Details
                      </summary>
                      <pre className="mt-1 max-h-40 overflow-auto rounded bg-muted p-2 text-[11px]">
                        {JSON.stringify(alert.details, null, 2)}
                      </pre>
                    </details>
                  </div>
                  <div className="flex sm:flex-col gap-2 sm:items-end">
                    {alert.status === "open" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => resolveAlert(alert.id)}
                      >
                        Mark resolved
                      </Button>
                    ) : (
                      <Badge variant="outline" className="gap-1">
                        <CheckCircle2 className="h-3 w-3 text-primary" />
                        resolved
                      </Badge>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}

export default AuditAlerts;
