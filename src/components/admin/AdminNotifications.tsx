import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, AlertTriangle, Trash2, Bell, Clock, LifeBuoy } from "lucide-react";
import { cn } from "@/lib/utils";

interface AdminNotificationsProps {
  onNavigate: (tab: string) => void;
}

interface CountRow {
  total: number;
  overdue: number;
  oldestAt?: string | null;
}

const OVERDUE_HOURS = 48;

export const AdminNotifications = ({ onNavigate }: AdminNotificationsProps) => {
  const [loading, setLoading] = useState(true);
  const [incomplete, setIncomplete] = useState<CountRow>({ total: 0, overdue: 0 });
  const [cancellations, setCancellations] = useState<CountRow>({ total: 0, overdue: 0 });
  const [deletions, setDeletions] = useState<CountRow>({ total: 0, overdue: 0 });
  const [auditAlerts, setAuditAlerts] = useState<CountRow>({ total: 0, overdue: 0 });
  const [support, setSupport] = useState<CountRow>({ total: 0, overdue: 0 });

  useEffect(() => {
    const overdueCutoff = new Date(Date.now() - OVERDUE_HOURS * 60 * 60 * 1000).toISOString();

    const load = async () => {
      setLoading(true);
      const [im, cr, dr, aa, sr] = await Promise.all([
        supabase
          .from("incomplete_match_reviews")
          .select("flagged_at", { count: "exact" })
          .eq("status", "pending")
          .order("flagged_at", { ascending: true }),
        supabase
          .from("match_cancellation_reviews")
          .select("created_at", { count: "exact" })
          .eq("status", "pending")
          .order("created_at", { ascending: true }),
        supabase
          .from("account_deletion_requests")
          .select("requested_at", { count: "exact" })
          .eq("status", "pending")
          .order("requested_at", { ascending: true }),
        supabase
          .from("audit_log_alerts")
          .select("created_at", { count: "exact" })
          .eq("status", "open")
          .order("created_at", { ascending: true }),
        supabase
          .from("support_requests")
          .select("created_at", { count: "exact" })
          .eq("status", "open")
          .order("created_at", { ascending: true }),
      ]);

      const summarize = (rows: any[] | null, total: number | null, dateKey: string): CountRow => {
        const list = rows || [];
        const overdue = list.filter((r) => r[dateKey] && r[dateKey] < overdueCutoff).length;
        return { total: total || 0, overdue, oldestAt: list[0]?.[dateKey] || null };
      };

      setIncomplete(summarize(im.data as any[], im.count, "flagged_at"));
      setCancellations(summarize(cr.data as any[], cr.count, "created_at"));
      setDeletions(summarize(dr.data as any[], dr.count, "requested_at"));
      setAuditAlerts(summarize(aa.data as any[], aa.count, "created_at"));
      setSupport(summarize(sr.data as any[], sr.count, "created_at"));
      setLoading(false);
    };

    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, []);

  const items = [
    {
      key: "reviews",
      label: "Incomplete Match Reviews",
      Icon: AlertCircle,
      data: incomplete,
      tab: "reviews",
    },
    {
      key: "cancellations",
      label: "Cancellation Reviews",
      Icon: AlertTriangle,
      data: cancellations,
      tab: "reviews",
    },
    {
      key: "deletions",
      label: "Account Deletion Requests",
      Icon: Trash2,
      data: deletions,
      tab: "deletions",
    },
    {
      key: "audit",
      label: "Audit Alerts",
      Icon: Bell,
      data: auditAlerts,
      tab: "audit",
    },
    {
      key: "support",
      label: "Support Requests",
      Icon: LifeBuoy,
      data: support,
      tab: "support",
    },
  ];

  const totalPending = items.reduce((sum, i) => sum + i.data.total, 0);
  const totalOverdue = items.reduce((sum, i) => sum + i.data.overdue, 0);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5" aria-hidden="true" />
          <CardTitle>Admin Notifications</CardTitle>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Badge variant="secondary">{totalPending} pending</Badge>
          {totalOverdue > 0 && (
            <Badge variant="destructive" className="gap-1">
              <Clock className="h-3 w-3" aria-hidden="true" />
              {totalOverdue} overdue
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground py-4 text-center">Loading...</p>
        ) : totalPending === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            All clear — no pending admin items.
          </p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2" role="list">
            {items.map(({ key, label, Icon, data, tab }) => {
              const isOverdue = data.overdue > 0;
              const empty = data.total === 0;
              return (
                <li key={key}>
                  <button
                    type="button"
                    onClick={() => onNavigate(tab)}
                    disabled={empty}
                    className={cn(
                      "w-full text-left rounded-2xl border p-3 transition-colors",
                      empty
                        ? "bg-muted/40 border-border opacity-60 cursor-default"
                        : isOverdue
                          ? "bg-destructive/5 border-destructive/30 hover:bg-destructive/10"
                          : "bg-card border-border hover:bg-muted/60",
                    )}
                    aria-label={`${label}: ${data.total} pending${isOverdue ? `, ${data.overdue} overdue` : ""}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <Icon
                          className={cn(
                            "h-4 w-4 shrink-0",
                            isOverdue ? "text-destructive" : "text-muted-foreground",
                          )}
                          aria-hidden="true"
                        />
                        <span className="font-medium text-sm truncate">{label}</span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Badge variant={empty ? "outline" : "secondary"}>{data.total}</Badge>
                        {isOverdue && (
                          <Badge variant="destructive" className="gap-1">
                            <Clock className="h-3 w-3" aria-hidden="true" />
                            {data.overdue}
                          </Badge>
                        )}
                      </div>
                    </div>
                    {!empty && (
                      <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                        <span>
                          {isOverdue
                            ? `Overdue threshold: ${OVERDUE_HOURS}h`
                            : "Within review window"}
                        </span>
                        <Button
                          asChild={false}
                          size="sm"
                          variant="ghost"
                          className="h-auto py-0.5 px-2"
                          onClick={(e) => {
                            e.stopPropagation();
                            onNavigate(tab);
                          }}
                        >
                          Open
                        </Button>
                      </div>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
};

export default AdminNotifications;
