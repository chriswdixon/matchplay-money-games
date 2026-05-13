
-- Reusable per-match crediting logic (extracted from the finalize trigger)
CREATE OR REPLACE FUNCTION public.credit_match_winnings_for(_match_id UUID)
RETURNS TABLE(credited_count INT, pot NUMERIC, payout NUMERIC)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_match RECORD;
  v_result RECORD;
  v_participant RECORD;
  v_winner_id UUID;
  v_winners UUID[];
  v_pot NUMERIC := 0;
  v_payout NUMERIC := 0;
  v_account_id UUID;
  v_existing INT;
  v_credited INT := 0;
BEGIN
  SELECT id, buy_in_amount, is_team_format INTO v_match
  FROM public.matches WHERE id = _match_id;
  IF v_match.id IS NULL THEN RETURN; END IF;

  SELECT winners, winner_id, finalized_at INTO v_result
  FROM public.match_results WHERE match_id = _match_id
  ORDER BY finalized_at DESC NULLS LAST LIMIT 1;
  IF v_result IS NULL OR v_result.finalized_at IS NULL THEN RETURN; END IF;

  -- Backfill missing buy-ins
  FOR v_participant IN
    SELECT user_id FROM public.match_participants
    WHERE match_id = _match_id AND status = 'active'
  LOOP
    SELECT COUNT(*) INTO v_existing FROM public.account_transactions
    WHERE match_id = _match_id AND user_id = v_participant.user_id AND transaction_type = 'match_buyin';

    IF v_existing = 0 AND v_match.buy_in_amount > 0 THEN
      SELECT id INTO v_account_id FROM public.player_accounts WHERE user_id = v_participant.user_id;
      IF v_account_id IS NOT NULL THEN
        BEGIN
          INSERT INTO public.account_transactions(user_id, account_id, amount, transaction_type, match_id, description, metadata)
          VALUES (v_participant.user_id, v_account_id, -v_match.buy_in_amount, 'match_buyin', _match_id,
                  'Match buy-in (reconciliation)', jsonb_build_object('auto_reconciled', true));
          PERFORM public.debit_player_balance(v_participant.user_id, v_match.buy_in_amount);
        EXCEPTION WHEN unique_violation THEN NULL;
        END;
      END IF;
    END IF;

    v_pot := v_pot + v_match.buy_in_amount;
  END LOOP;

  IF v_result.winners IS NOT NULL AND array_length(v_result.winners, 1) > 0 THEN
    v_winners := v_result.winners;
  ELSIF v_result.winner_id IS NOT NULL THEN
    v_winners := ARRAY[v_result.winner_id];
  ELSE
    RETURN;
  END IF;

  IF v_pot <= 0 THEN RETURN; END IF;
  v_payout := floor(v_pot / array_length(v_winners, 1));

  FOREACH v_winner_id IN ARRAY v_winners LOOP
    SELECT id INTO v_account_id FROM public.player_accounts WHERE user_id = v_winner_id;
    IF v_account_id IS NULL THEN CONTINUE; END IF;
    BEGIN
      INSERT INTO public.account_transactions(user_id, account_id, amount, transaction_type, match_id, description, metadata)
      VALUES (v_winner_id, v_account_id, v_payout, 'winning', _match_id,
              'Match winnings' || CASE WHEN array_length(v_winners,1) > 1 THEN ' (split)' ELSE '' END,
              jsonb_build_object('auto_credited', true, 'pot', v_pot,
                                 'winner_count', array_length(v_winners, 1),
                                 'is_team_format', COALESCE(v_match.is_team_format, false)));
      PERFORM public.credit_player_balance(v_winner_id, v_payout);
      v_credited := v_credited + 1;
    EXCEPTION WHEN unique_violation THEN NULL;
    END;
  END LOOP;

  credited_count := v_credited;
  pot := v_pot;
  payout := v_payout;
  RETURN NEXT;
END;
$$;

-- Replace the finalize trigger to delegate to the reusable function
CREATE OR REPLACE FUNCTION public.auto_credit_match_winnings()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.finalized_at IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.finalized_at IS NOT NULL THEN RETURN NEW; END IF;
  PERFORM public.credit_match_winnings_for(NEW.match_id);
  RETURN NEW;
END;
$$;

-- Reconciliation: find finalized matches missing winning transactions; retry; flag if still missing
CREATE OR REPLACE FUNCTION public.reconcile_match_payouts()
RETURNS TABLE(match_id UUID, status TEXT, credited INT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row RECORD;
  v_credit RECORD;
  v_still_missing INT;
BEGIN
  FOR v_row IN
    SELECT mr.match_id
    FROM public.match_results mr
    JOIN public.matches m ON m.id = mr.match_id
    WHERE mr.finalized_at IS NOT NULL
      AND m.buy_in_amount > 0
      AND (mr.winner_id IS NOT NULL OR (mr.winners IS NOT NULL AND array_length(mr.winners,1) > 0))
      AND NOT EXISTS (
        SELECT 1 FROM public.account_transactions at
        WHERE at.match_id = mr.match_id AND at.transaction_type = 'winning'
      )
  LOOP
    BEGIN
      SELECT * INTO v_credit FROM public.credit_match_winnings_for(v_row.match_id);
    EXCEPTION WHEN OTHERS THEN
      v_credit := NULL;
    END;

    SELECT COUNT(*) INTO v_still_missing FROM public.account_transactions
    WHERE account_transactions.match_id = v_row.match_id
      AND transaction_type = 'winning';

    IF v_still_missing = 0 THEN
      -- Flag for admin review (idempotent: skip if already an open alert)
      IF NOT EXISTS (
        SELECT 1 FROM public.audit_log_alerts a
        WHERE a.match_id = v_row.match_id
          AND a.expected_event = 'match_payout'
          AND a.status = 'open'
      ) THEN
        INSERT INTO public.audit_log_alerts(match_id, expected_event, severity, source_table, details, status)
        VALUES (v_row.match_id, 'match_payout', 'critical', 'match_results',
                jsonb_build_object('reason', 'reconcile_failed', 'auto_retry', true), 'open');
      END IF;
      match_id := v_row.match_id; status := 'flagged'; credited := 0;
    ELSE
      match_id := v_row.match_id; status := 'credited'; credited := COALESCE(v_credit.credited_count, 0);
    END IF;
    RETURN NEXT;
  END LOOP;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.reconcile_match_payouts() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.credit_match_winnings_for(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reconcile_match_payouts() TO service_role;
GRANT EXECUTE ON FUNCTION public.credit_match_winnings_for(UUID) TO service_role;

-- Schedule every 15 minutes
CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
BEGIN
  PERFORM cron.unschedule('reconcile-match-payouts');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule('reconcile-match-payouts', '*/15 * * * *',
  $cron$ SELECT public.reconcile_match_payouts(); $cron$);
