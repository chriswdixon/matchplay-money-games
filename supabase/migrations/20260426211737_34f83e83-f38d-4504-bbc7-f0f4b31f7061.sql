-- Alerts table for audit reconciliation
CREATE TABLE IF NOT EXISTS public.audit_log_alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  check_run_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  source_table TEXT NOT NULL,
  source_row_id UUID,
  match_id UUID,
  expected_event TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  severity TEXT NOT NULL DEFAULT 'warning',
  status TEXT NOT NULL DEFAULT 'open',
  resolved_at TIMESTAMPTZ,
  resolved_by UUID,
  resolution_note TEXT
);

CREATE INDEX IF NOT EXISTS idx_audit_alerts_status_created
  ON public.audit_log_alerts (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_alerts_match
  ON public.audit_log_alerts (match_id);

ALTER TABLE public.audit_log_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view audit alerts"
  ON public.audit_log_alerts FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can update audit alerts"
  ON public.audit_log_alerts FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Deny client inserts on audit alerts"
  ON public.audit_log_alerts FOR INSERT
  TO authenticated
  WITH CHECK (false);

CREATE POLICY "Deny client deletes on audit alerts"
  ON public.audit_log_alerts FOR DELETE
  TO authenticated
  USING (false);

-- Reconciliation function: scans last N hours of source rows, raises alerts for any
-- expected audit_log entry that is missing.
CREATE OR REPLACE FUNCTION public.reconcile_audit_log(p_lookback_hours integer DEFAULT 24)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_cutoff timestamptz := now() - make_interval(hours => p_lookback_hours);
  v_run_at timestamptz := now();
  v_score_missing int := 0;
  v_result_missing int := 0;
  v_txn_missing int := 0;
  v_participant_missing int := 0;
  v_total int := 0;
BEGIN
  -- 1) match_scores INSERTs -> 'score.created'
  WITH missing AS (
    SELECT ms.id, ms.match_id, ms.player_id, ms.hole_number, ms.created_at
    FROM public.match_scores ms
    WHERE ms.created_at >= v_cutoff
      AND NOT EXISTS (
        SELECT 1 FROM public.audit_log al
        WHERE al.event_type = 'score.created'
          AND al.match_id = ms.match_id
          AND al.user_id = ms.player_id
          AND (al.payload->>'hole_number')::int = ms.hole_number
          AND al.created_at >= ms.created_at - interval '5 minutes'
      )
  ), ins AS (
    INSERT INTO public.audit_log_alerts
      (check_run_at, source_table, source_row_id, match_id, expected_event, details, severity)
    SELECT v_run_at, 'match_scores', m.id, m.match_id, 'score.created',
           jsonb_build_object('hole_number', m.hole_number, 'player_id', m.player_id, 'source_created_at', m.created_at),
           'warning'
    FROM missing m
    WHERE NOT EXISTS (
      SELECT 1 FROM public.audit_log_alerts a
      WHERE a.source_table = 'match_scores'
        AND a.source_row_id = m.id
        AND a.expected_event = 'score.created'
        AND a.status = 'open'
    )
    RETURNING 1
  )
  SELECT count(*) INTO v_score_missing FROM ins;

  -- 2) match_results INSERTs -> 'result.created'
  WITH missing AS (
    SELECT mr.id, mr.match_id, mr.winner_id, mr.created_at
    FROM public.match_results mr
    WHERE mr.created_at >= v_cutoff
      AND NOT EXISTS (
        SELECT 1 FROM public.audit_log al
        WHERE al.event_type = 'result.created'
          AND al.match_id = mr.match_id
          AND al.created_at >= mr.created_at - interval '5 minutes'
      )
  ), ins AS (
    INSERT INTO public.audit_log_alerts
      (check_run_at, source_table, source_row_id, match_id, expected_event, details, severity)
    SELECT v_run_at, 'match_results', m.id, m.match_id, 'result.created',
           jsonb_build_object('winner_id', m.winner_id, 'source_created_at', m.created_at),
           'error'
    FROM missing m
    WHERE NOT EXISTS (
      SELECT 1 FROM public.audit_log_alerts a
      WHERE a.source_table = 'match_results'
        AND a.source_row_id = m.id
        AND a.expected_event = 'result.created'
        AND a.status = 'open'
    )
    RETURNING 1
  )
  SELECT count(*) INTO v_result_missing FROM ins;

  -- 3) account_transactions INSERTs -> 'transaction.<type>'
  WITH missing AS (
    SELECT at.id, at.match_id, at.user_id, at.transaction_type, at.amount, at.created_at
    FROM public.account_transactions at
    WHERE at.created_at >= v_cutoff
      AND NOT EXISTS (
        SELECT 1 FROM public.audit_log al
        WHERE al.event_type = 'transaction.' || at.transaction_type::text
          AND al.user_id = at.user_id
          AND COALESCE(al.match_id::text, '') = COALESCE(at.match_id::text, '')
          AND (al.payload->>'amount')::numeric = at.amount
          AND al.created_at >= at.created_at - interval '5 minutes'
      )
  ), ins AS (
    INSERT INTO public.audit_log_alerts
      (check_run_at, source_table, source_row_id, match_id, expected_event, details, severity)
    SELECT v_run_at, 'account_transactions', m.id, m.match_id,
           'transaction.' || m.transaction_type::text,
           jsonb_build_object(
             'user_id', m.user_id,
             'amount', m.amount,
             'transaction_type', m.transaction_type,
             'source_created_at', m.created_at
           ),
           'error'
    FROM missing m
    WHERE NOT EXISTS (
      SELECT 1 FROM public.audit_log_alerts a
      WHERE a.source_table = 'account_transactions'
        AND a.source_row_id = m.id
        AND a.status = 'open'
    )
    RETURNING 1
  )
  SELECT count(*) INTO v_txn_missing FROM ins;

  -- 4) match_participants status != 'active' updated recently -> participant.status.changed/admin_changed
  WITH missing AS (
    SELECT mp.id, mp.match_id, mp.user_id, mp.status, mp.joined_at
    FROM public.match_participants mp
    WHERE mp.status <> 'active'
      AND mp.joined_at >= v_cutoff -- proxy; participants don't have updated_at
      AND NOT EXISTS (
        SELECT 1 FROM public.audit_log al
        WHERE al.event_type IN ('participant.status.changed', 'participant.status.admin_changed')
          AND al.match_id = mp.match_id
          AND al.user_id = mp.user_id
          AND (al.payload->>'new_status') = mp.status
      )
  ), ins AS (
    INSERT INTO public.audit_log_alerts
      (check_run_at, source_table, source_row_id, match_id, expected_event, details, severity)
    SELECT v_run_at, 'match_participants', m.id, m.match_id, 'participant.status.changed',
           jsonb_build_object('user_id', m.user_id, 'new_status', m.status),
           'warning'
    FROM missing m
    WHERE NOT EXISTS (
      SELECT 1 FROM public.audit_log_alerts a
      WHERE a.source_table = 'match_participants'
        AND a.source_row_id = m.id
        AND a.expected_event = 'participant.status.changed'
        AND a.status = 'open'
    )
    RETURNING 1
  )
  SELECT count(*) INTO v_participant_missing FROM ins;

  v_total := v_score_missing + v_result_missing + v_txn_missing + v_participant_missing;

  -- Record a summary entry in audit_log itself for traceability
  PERFORM public.write_audit_log(
    'admin_override'::public.audit_category,
    'audit.reconcile.completed',
    NULL, NULL, NULL,
    format('Audit reconciliation: %s new alert(s) over last %s h', v_total, p_lookback_hours),
    jsonb_build_object(
      'lookback_hours', p_lookback_hours,
      'score_missing', v_score_missing,
      'result_missing', v_result_missing,
      'transaction_missing', v_txn_missing,
      'participant_missing', v_participant_missing,
      'total', v_total,
      'run_at', v_run_at
    )
  );

  RETURN jsonb_build_object(
    'run_at', v_run_at,
    'lookback_hours', p_lookback_hours,
    'score_missing', v_score_missing,
    'result_missing', v_result_missing,
    'transaction_missing', v_txn_missing,
    'participant_missing', v_participant_missing,
    'total_alerts_created', v_total
  );
END;
$$;

-- Schedule daily reconciliation at 03:15 UTC via pg_cron.
-- pg_cron is already enabled in this project (used by other jobs).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('reconcile-audit-log-daily')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'reconcile-audit-log-daily');

    PERFORM cron.schedule(
      'reconcile-audit-log-daily',
      '15 3 * * *',
      $cron$ SELECT public.reconcile_audit_log(24); $cron$
    );
  END IF;
END $$;