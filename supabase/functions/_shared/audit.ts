// Shared helper for edge functions to write audit log entries.
// Uses the service-role client (bypasses RLS).
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

export type AuditCategory =
  | "score"
  | "transaction"
  | "payout"
  | "dispute"
  | "admin_override";

export interface AuditWrite {
  category: AuditCategory;
  event_type: string;
  match_id?: string | null;
  user_id?: string | null;
  actor_id?: string | null;
  summary: string;
  payload?: Record<string, unknown>;
}

export async function writeAudit(
  supabase: SupabaseClient,
  entry: AuditWrite,
): Promise<void> {
  try {
    const { error } = await supabase.from("audit_log").insert({
      category: entry.category,
      event_type: entry.event_type,
      match_id: entry.match_id ?? null,
      user_id: entry.user_id ?? null,
      actor_id: entry.actor_id ?? null,
      summary: entry.summary,
      payload: entry.payload ?? {},
    });
    if (error) {
      // Audit failures must never block business logic — just log.
      console.error("[audit] insert failed:", error.message);
    }
  } catch (e) {
    console.error("[audit] insert threw:", e);
  }
}
