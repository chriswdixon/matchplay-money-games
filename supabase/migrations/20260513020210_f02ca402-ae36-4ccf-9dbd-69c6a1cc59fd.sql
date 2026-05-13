
CREATE OR REPLACE FUNCTION public.validate_and_join_match(
  p_match_id uuid,
  p_pin text DEFAULT NULL,
  p_team_number integer DEFAULT NULL,
  p_set_team_pin text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_match RECORD;
  v_required_pin TEXT;
  v_failed INT;
  v_last TIMESTAMPTZ;
  v_delay INT;
  v_count INT;
  v_team INT;
  v_account_id UUID;
  v_balance NUMERIC;
  v_debit RECORD;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('error', 'Authentication required');
  END IF;

  SELECT * INTO v_match FROM public.matches WHERE id = p_match_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('error', 'Match not found'); END IF;

  IF v_match.status <> 'open' THEN
    RETURN jsonb_build_object('error',
      CASE v_match.status
        WHEN 'cancelled' THEN 'This match has been cancelled and can no longer be joined'
        WHEN 'started'   THEN 'This match has already started and is no longer accepting players'
        WHEN 'completed' THEN 'This match has already been completed'
        ELSE 'This match is no longer open for new players'
      END);
  END IF;

  SELECT COUNT(*) INTO v_count FROM public.match_participants
  WHERE match_id = p_match_id AND status = 'active';
  IF v_count >= v_match.max_participants THEN
    RETURN jsonb_build_object('error', 'Match is full');
  END IF;

  IF EXISTS (SELECT 1 FROM public.match_participants WHERE match_id = p_match_id AND user_id = auth.uid()) THEN
    RETURN jsonb_build_object('error', 'Already joined this match');
  END IF;

  v_team := COALESCE(p_team_number, 1);
  IF v_team NOT BETWEEN 1 AND 4 THEN
    RETURN jsonb_build_object('error', 'Invalid team number');
  END IF;

  SELECT pin INTO v_required_pin
  FROM public.match_team_pins WHERE match_id = p_match_id AND team_number = v_team;

  -- ---------- helper logic: charge buy-in ----------
  -- Run only when there's a real buy-in. Atomic conditional debit; fail fast if insufficient.
  IF v_match.buy_in_amount > 0 THEN
    -- Ensure account row exists
    SELECT id, balance INTO v_account_id, v_balance
    FROM public.player_accounts WHERE user_id = auth.uid();
    IF v_account_id IS NULL THEN
      INSERT INTO public.player_accounts (user_id, balance) VALUES (auth.uid(), 0)
      RETURNING id, balance INTO v_account_id, v_balance;
    END IF;

    SELECT * INTO v_debit FROM public.debit_player_balance(auth.uid(), v_match.buy_in_amount);
    IF v_debit IS NULL THEN
      RETURN jsonb_build_object('error',
        format('Insufficient balance. You need $%s to join this match.', v_match.buy_in_amount));
    END IF;

    BEGIN
      INSERT INTO public.account_transactions
        (user_id, account_id, amount, transaction_type, match_id, description, metadata)
      VALUES
        (auth.uid(), v_account_id, -v_match.buy_in_amount, 'match_buyin', p_match_id,
         'Buy-in for match ' || p_match_id::text,
         jsonb_build_object('charged_on_join', true));
    EXCEPTION WHEN unique_violation THEN
      -- Already charged previously: refund the duplicate debit and continue.
      PERFORM public.credit_player_balance(auth.uid(), v_match.buy_in_amount);
    WHEN OTHERS THEN
      -- Refund and bubble up.
      PERFORM public.credit_player_balance(auth.uid(), v_match.buy_in_amount);
      RAISE;
    END;
  END IF;
  -- ---------- end charge buy-in ----------

  -- Setting a new team PIN (first joiner on team)
  IF p_set_team_pin IS NOT NULL THEN
    IF p_set_team_pin !~ '^\d{4}$' THEN
      -- refund and bail
      IF v_match.buy_in_amount > 0 THEN
        PERFORM public.credit_player_balance(auth.uid(), v_match.buy_in_amount);
        DELETE FROM public.account_transactions
        WHERE match_id = p_match_id AND user_id = auth.uid() AND transaction_type = 'match_buyin';
      END IF;
      RETURN jsonb_build_object('error', 'PIN must be exactly 4 digits');
    END IF;
    IF v_required_pin IS NOT NULL THEN
      IF v_match.buy_in_amount > 0 THEN
        PERFORM public.credit_player_balance(auth.uid(), v_match.buy_in_amount);
        DELETE FROM public.account_transactions
        WHERE match_id = p_match_id AND user_id = auth.uid() AND transaction_type = 'match_buyin';
      END IF;
      RETURN jsonb_build_object('error', 'Team already has a PIN set');
    END IF;

    INSERT INTO public.match_team_pins (match_id, team_number, pin, creator_id)
    VALUES (p_match_id, v_team, p_set_team_pin, auth.uid());

    INSERT INTO public.match_participants (match_id, user_id, team_number)
    VALUES (p_match_id, auth.uid(), p_team_number);

    RETURN jsonb_build_object('success', true, 'message', 'Team PIN set and joined successfully');
  END IF;

  -- Brute force protection on PIN entry
  SELECT COUNT(*) FILTER (WHERE NOT success), MAX(attempted_at)
    INTO v_failed, v_last
  FROM public.pin_attempts
  WHERE user_id = auth.uid() AND match_id = p_match_id
    AND attempted_at > now() - INTERVAL '5 minutes';

  IF v_failed >= 5 THEN
    IF v_match.buy_in_amount > 0 THEN
      PERFORM public.credit_player_balance(auth.uid(), v_match.buy_in_amount);
      DELETE FROM public.account_transactions
      WHERE match_id = p_match_id AND user_id = auth.uid() AND transaction_type = 'match_buyin';
    END IF;
    RETURN jsonb_build_object('error', 'Too many failed attempts. Please try again in 5 minutes.', 'retry_after', 300);
  END IF;

  IF v_failed > 0 AND v_last IS NOT NULL THEN
    v_delay := POWER(2, v_failed - 1)::INT;
    IF EXTRACT(EPOCH FROM (now() - v_last)) < v_delay THEN
      IF v_match.buy_in_amount > 0 THEN
        PERFORM public.credit_player_balance(auth.uid(), v_match.buy_in_amount);
        DELETE FROM public.account_transactions
        WHERE match_id = p_match_id AND user_id = auth.uid() AND transaction_type = 'match_buyin';
      END IF;
      RETURN jsonb_build_object('error',
        format('Please wait %s seconds before trying again', v_delay), 'retry_after', v_delay);
    END IF;
  END IF;

  IF v_required_pin IS NOT NULL THEN
    IF p_pin IS NULL OR p_pin <> v_required_pin THEN
      INSERT INTO public.pin_attempts (user_id, match_id, team_number, success)
      VALUES (auth.uid(), p_match_id, p_team_number, false);
      IF v_match.buy_in_amount > 0 THEN
        PERFORM public.credit_player_balance(auth.uid(), v_match.buy_in_amount);
        DELETE FROM public.account_transactions
        WHERE match_id = p_match_id AND user_id = auth.uid() AND transaction_type = 'match_buyin';
      END IF;
      RETURN jsonb_build_object('error', 'Incorrect PIN');
    END IF;
    INSERT INTO public.pin_attempts (user_id, match_id, team_number, success)
    VALUES (auth.uid(), p_match_id, p_team_number, true);
  END IF;

  INSERT INTO public.match_participants (match_id, user_id, team_number)
  VALUES (p_match_id, auth.uid(), p_team_number);

  RETURN jsonb_build_object(
    'success', true,
    'message', CASE WHEN v_match.buy_in_amount > 0
      THEN format('Joined! $%s buy-in deducted.', v_match.buy_in_amount)
      ELSE 'Successfully joined match' END,
    'charged', v_match.buy_in_amount
  );
END;
$function$;

-- Refund buy-in when leaving an open match
CREATE OR REPLACE FUNCTION public.leave_match_with_refund(p_match_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_match RECORD;
  v_account_id UUID;
  v_existing INT;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('error', 'Authentication required');
  END IF;

  SELECT * INTO v_match FROM public.matches WHERE id = p_match_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('error', 'Match not found'); END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.match_participants
    WHERE match_id = p_match_id AND user_id = auth.uid()
  ) THEN
    RETURN jsonb_build_object('error', 'You are not in this match');
  END IF;

  -- Refund only if not yet started/completed and a buy-in was actually charged
  IF v_match.status = 'open' AND v_match.buy_in_amount > 0 THEN
    SELECT COUNT(*) INTO v_existing FROM public.account_transactions
    WHERE match_id = p_match_id AND user_id = auth.uid() AND transaction_type = 'match_buyin';

    IF v_existing > 0 THEN
      SELECT id INTO v_account_id FROM public.player_accounts WHERE user_id = auth.uid();
      IF v_account_id IS NOT NULL THEN
        PERFORM public.credit_player_balance(auth.uid(), v_match.buy_in_amount);
        INSERT INTO public.account_transactions
          (user_id, account_id, amount, transaction_type, match_id, description, metadata)
        VALUES
          (auth.uid(), v_account_id, v_match.buy_in_amount, 'match_cancellation', p_match_id,
           'Buy-in refunded (left open match)',
           jsonb_build_object('refund_on_leave', true));
      END IF;
    END IF;
  END IF;

  DELETE FROM public.match_participants
  WHERE match_id = p_match_id AND user_id = auth.uid();

  RETURN jsonb_build_object('success', true, 'refunded',
    (v_match.status = 'open' AND v_match.buy_in_amount > 0));
END;
$$;

GRANT EXECUTE ON FUNCTION public.leave_match_with_refund(uuid) TO authenticated;
