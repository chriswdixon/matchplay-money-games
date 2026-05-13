CREATE OR REPLACE FUNCTION public.reconcile_match_buyins()
RETURNS TABLE(alerts_created integer, matches_checked integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_alerts_created integer := 0;
  v_matches_checked integer := 0;
  v_rowcount integer := 0;
  r record;
BEGIN
  FOR r IN
    SELECT m.id AS match_id, mp.user_id, m.buy_in_amount AS expected_amount, m.status AS match_status
    FROM matches m
    JOIN match_participants mp ON mp.match_id = m.id AND mp.status = 'active'
    WHERE m.buy_in_amount > 0
      AND NOT EXISTS (
        SELECT 1 FROM account_transactions t
        WHERE t.match_id = m.id AND t.user_id = mp.user_id AND t.transaction_type = 'match_buyin'
      )
  LOOP
    INSERT INTO audit_log_alerts (match_id, source_table, expected_event, severity, status, details)
    SELECT r.match_id, 'match_participants', 'match_buyin', 'critical', 'open',
      jsonb_build_object('issue','missing_buyin_charge','user_id',r.user_id,
                         'expected_amount',r.expected_amount,'match_status',r.match_status)
    WHERE NOT EXISTS (
      SELECT 1 FROM audit_log_alerts a
      WHERE a.match_id = r.match_id AND a.status = 'open'
        AND a.expected_event = 'match_buyin'
        AND (a.details->>'user_id')::uuid = r.user_id
        AND (a.details->>'issue') = 'missing_buyin_charge'
    );
    GET DIAGNOSTICS v_rowcount = ROW_COUNT;
    v_alerts_created := v_alerts_created + v_rowcount;
  END LOOP;

  FOR r IN
    SELECT t.match_id, t.user_id, ABS(t.amount)::int AS expected_amount
    FROM account_transactions t
    JOIN matches m ON m.id = t.match_id
    WHERE t.transaction_type = 'match_buyin'
      AND m.status = 'open'
      AND NOT EXISTS (
        SELECT 1 FROM match_participants mp
        WHERE mp.match_id = t.match_id AND mp.user_id = t.user_id AND mp.status = 'active'
      )
      AND NOT EXISTS (
        SELECT 1 FROM account_transactions r2
        WHERE r2.match_id = t.match_id AND r2.user_id = t.user_id
          AND r2.transaction_type = 'match_cancellation'
      )
  LOOP
    INSERT INTO audit_log_alerts (match_id, source_table, expected_event, severity, status, details)
    SELECT r.match_id, 'match_participants', 'match_cancellation', 'warning', 'open',
      jsonb_build_object('issue','missing_leave_refund','user_id',r.user_id,
                         'expected_amount',r.expected_amount)
    WHERE NOT EXISTS (
      SELECT 1 FROM audit_log_alerts a
      WHERE a.match_id = r.match_id AND a.status = 'open'
        AND a.expected_event = 'match_cancellation'
        AND (a.details->>'user_id')::uuid = r.user_id
        AND (a.details->>'issue') = 'missing_leave_refund'
    );
    GET DIAGNOSTICS v_rowcount = ROW_COUNT;
    v_alerts_created := v_alerts_created + v_rowcount;
  END LOOP;

  SELECT count(*) INTO v_matches_checked FROM matches WHERE buy_in_amount > 0;
  RETURN QUERY SELECT v_alerts_created, v_matches_checked;
END;
$$;

CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
BEGIN
  PERFORM cron.unschedule('reconcile-match-buyins');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'reconcile-match-buyins',
  '*/30 * * * *',
  $$ SELECT public.reconcile_match_buyins(); $$
);