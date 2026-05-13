CREATE OR REPLACE FUNCTION public.leave_match_with_refund(p_match_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID;
  v_match RECORD;
  v_account_id UUID;
  v_buyin_total NUMERIC := 0;
  v_refund_total NUMERIC := 0;
  v_net NUMERIC := 0;
  v_refund_amount NUMERIC := 0;
  v_refunded BOOLEAN := false;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('error', 'Authentication required');
  END IF;

  SELECT * INTO v_match FROM public.matches WHERE id = p_match_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Match not found');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.match_participants
    WHERE match_id = p_match_id AND user_id = v_uid
  ) THEN
    RETURN jsonb_build_object('error', 'You are not in this match');
  END IF;

  -- Refund only if the match is still open and had a positive buy-in.
  IF v_match.status = 'open' AND v_match.buy_in_amount > 0 THEN
    -- Lock all of this user's transactions for this match so concurrent
    -- leave attempts can't both decide to refund.
    PERFORM 1 FROM public.account_transactions
    WHERE match_id = p_match_id AND user_id = v_uid
    FOR UPDATE;

    SELECT COALESCE(SUM(CASE WHEN transaction_type = 'match_buyin' THEN -amount ELSE 0 END), 0),
           COALESCE(SUM(CASE WHEN transaction_type = 'match_cancellation' THEN amount ELSE 0 END), 0)
      INTO v_buyin_total, v_refund_total
    FROM public.account_transactions
    WHERE match_id = p_match_id AND user_id = v_uid;

    -- buyin amounts are stored negative; v_buyin_total is the positive sum debited.
    v_net := v_buyin_total - v_refund_total;

    IF v_buyin_total <= 0 THEN
      INSERT INTO public.audit_log_alerts
        (match_id, source_table, expected_event, severity, status, details)
      VALUES (p_match_id, 'match_participants', 'match_cancellation', 'warning', 'open',
        jsonb_build_object('issue','leave_without_buyin','user_id',v_uid));
    ELSIF v_refund_total > 0 THEN
      -- Already refunded previously — do not issue another refund.
      INSERT INTO public.audit_log_alerts
        (match_id, source_table, expected_event, severity, status, details)
      VALUES (p_match_id, 'match_participants', 'match_cancellation', 'warning', 'open',
        jsonb_build_object('issue','duplicate_refund_blocked','user_id',v_uid,
                           'buyin_total',v_buyin_total,'refund_total',v_refund_total));
    ELSIF v_net <= 0 THEN
      INSERT INTO public.audit_log_alerts
        (match_id, source_table, expected_event, severity, status, details)
      VALUES (p_match_id, 'match_participants', 'match_cancellation', 'warning', 'open',
        jsonb_build_object('issue','no_outstanding_balance','user_id',v_uid,
                           'buyin_total',v_buyin_total,'refund_total',v_refund_total));
    ELSE
      v_refund_amount := LEAST(v_net, v_match.buy_in_amount);

      SELECT id INTO v_account_id FROM public.player_accounts WHERE user_id = v_uid;
      IF v_account_id IS NULL THEN
        INSERT INTO public.player_accounts (user_id, balance) VALUES (v_uid, 0)
        RETURNING id INTO v_account_id;
      END IF;

      PERFORM public.credit_player_balance(v_uid, v_refund_amount);
      INSERT INTO public.account_transactions
        (user_id, account_id, amount, transaction_type, match_id, description, metadata)
      VALUES
        (v_uid, v_account_id, v_refund_amount, 'match_cancellation', p_match_id,
         'Buy-in refunded (left open match)',
         jsonb_build_object('refund_on_leave', true,
                            'buyin_total', v_buyin_total,
                            'refund_amount', v_refund_amount));
      v_refunded := true;
    END IF;
  END IF;

  DELETE FROM public.match_participants
  WHERE match_id = p_match_id AND user_id = v_uid;

  RETURN jsonb_build_object('success', true, 'refunded', v_refunded,
                            'refund_amount', v_refund_amount);
END;
$$;