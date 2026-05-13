CREATE TABLE IF NOT EXISTS public.match_join_idempotency (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  idempotency_key text NOT NULL,
  match_id uuid NOT NULL,
  result jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  UNIQUE (user_id, idempotency_key)
);

ALTER TABLE public.match_join_idempotency ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view their idempotency rows"
  ON public.match_join_idempotency FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_match_join_idem_created
  ON public.match_join_idempotency (created_at);

CREATE OR REPLACE FUNCTION public.validate_and_join_match(
  p_match_id uuid,
  p_pin text DEFAULT NULL,
  p_team_number integer DEFAULT NULL,
  p_set_team_pin text DEFAULT NULL,
  p_idempotency_key text DEFAULT NULL
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
  v_uid UUID;
  v_idem_id UUID;
  v_existing_result JSONB;
  v_result JSONB;

  -- Inline finalize via subroutine: store result on idempotency row if any
  -- (handled inline at each return via PERFORM)
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('error', 'Authentication required');
  END IF;

  -- Idempotency: claim or replay
  IF p_idempotency_key IS NOT NULL AND length(p_idempotency_key) > 0 THEN
    INSERT INTO public.match_join_idempotency (user_id, idempotency_key, match_id)
    VALUES (v_uid, p_idempotency_key, p_match_id)
    ON CONFLICT (user_id, idempotency_key) DO NOTHING
    RETURNING id INTO v_idem_id;

    IF v_idem_id IS NULL THEN
      SELECT id, result INTO v_idem_id, v_existing_result
      FROM public.match_join_idempotency
      WHERE user_id = v_uid AND idempotency_key = p_idempotency_key;

      IF v_existing_result IS NOT NULL THEN
        RETURN v_existing_result;
      END IF;
      RETURN jsonb_build_object(
        'error', 'A previous join attempt is still being processed. Please wait a moment and try again.',
        'in_progress', true
      );
    END IF;
  END IF;

  SELECT * INTO v_match FROM public.matches WHERE id = p_match_id;
  IF NOT FOUND THEN
    PERFORM public.log_match_join_audit(p_match_id, v_uid, 'match_join_failed',
      'Join failed: match not found', jsonb_build_object('reason','match_not_found'));
    v_result := jsonb_build_object('error', 'Match not found');
    IF v_idem_id IS NOT NULL THEN
      UPDATE public.match_join_idempotency
      SET result = v_result, completed_at = now() WHERE id = v_idem_id;
    END IF;
    RETURN v_result;
  END IF;

  IF v_match.status <> 'open' THEN
    PERFORM public.log_match_join_audit(p_match_id, v_uid, 'match_join_failed',
      'Join failed: match not open',
      jsonb_build_object('reason','match_not_open','match_status', v_match.status));
    v_result := jsonb_build_object('error',
      CASE v_match.status
        WHEN 'cancelled' THEN 'This match has been cancelled and can no longer be joined'
        WHEN 'started'   THEN 'This match has already started and is no longer accepting players'
        WHEN 'completed' THEN 'This match has already been completed'
        ELSE 'This match is no longer open for new players'
      END);
    IF v_idem_id IS NOT NULL THEN
      UPDATE public.match_join_idempotency SET result = v_result, completed_at = now() WHERE id = v_idem_id;
    END IF;
    RETURN v_result;
  END IF;

  SELECT COUNT(*) INTO v_count FROM public.match_participants
  WHERE match_id = p_match_id AND status = 'active';
  IF v_count >= v_match.max_participants THEN
    PERFORM public.log_match_join_audit(p_match_id, v_uid, 'match_join_failed',
      'Join failed: match full', jsonb_build_object('reason','match_full'));
    v_result := jsonb_build_object('error', 'Match is full');
    IF v_idem_id IS NOT NULL THEN
      UPDATE public.match_join_idempotency SET result = v_result, completed_at = now() WHERE id = v_idem_id;
    END IF;
    RETURN v_result;
  END IF;

  IF EXISTS (SELECT 1 FROM public.match_participants WHERE match_id = p_match_id AND user_id = v_uid) THEN
    PERFORM public.log_match_join_audit(p_match_id, v_uid, 'match_join_failed',
      'Join failed: already joined', jsonb_build_object('reason','already_joined'));
    v_result := jsonb_build_object('error', 'Already joined this match');
    IF v_idem_id IS NOT NULL THEN
      UPDATE public.match_join_idempotency SET result = v_result, completed_at = now() WHERE id = v_idem_id;
    END IF;
    RETURN v_result;
  END IF;

  v_team := COALESCE(p_team_number, 1);
  IF v_team NOT BETWEEN 1 AND 4 THEN
    PERFORM public.log_match_join_audit(p_match_id, v_uid, 'match_join_failed',
      'Join failed: invalid team number',
      jsonb_build_object('reason','invalid_team_number','team_number',v_team));
    v_result := jsonb_build_object('error', 'Invalid team number');
    IF v_idem_id IS NOT NULL THEN
      UPDATE public.match_join_idempotency SET result = v_result, completed_at = now() WHERE id = v_idem_id;
    END IF;
    RETURN v_result;
  END IF;

  SELECT pin INTO v_required_pin
  FROM public.match_team_pins WHERE match_id = p_match_id AND team_number = v_team;

  IF v_match.buy_in_amount > 0 THEN
    SELECT id, balance INTO v_account_id, v_balance
    FROM public.player_accounts WHERE user_id = v_uid;
    IF v_account_id IS NULL THEN
      INSERT INTO public.player_accounts (user_id, balance) VALUES (v_uid, 0)
      RETURNING id, balance INTO v_account_id, v_balance;
    END IF;

    SELECT * INTO v_debit FROM public.debit_player_balance(v_uid, v_match.buy_in_amount);
    IF v_debit IS NULL THEN
      PERFORM public.log_match_join_audit(p_match_id, v_uid, 'match_join_failed',
        'Join failed: insufficient balance',
        jsonb_build_object('reason','insufficient_balance','required', v_match.buy_in_amount,'balance', v_balance));
      v_result := jsonb_build_object('error',
        format('Insufficient balance. You need $%s to join this match.', v_match.buy_in_amount));
      IF v_idem_id IS NOT NULL THEN
        UPDATE public.match_join_idempotency SET result = v_result, completed_at = now() WHERE id = v_idem_id;
      END IF;
      RETURN v_result;
    END IF;

    BEGIN
      INSERT INTO public.account_transactions
        (user_id, account_id, amount, transaction_type, match_id, description, metadata)
      VALUES
        (v_uid, v_account_id, -v_match.buy_in_amount, 'match_buyin', p_match_id,
         'Buy-in for match ' || p_match_id::text,
         jsonb_build_object('charged_on_join', true,
                            'idempotency_key', p_idempotency_key));
    EXCEPTION WHEN unique_violation THEN
      PERFORM public.credit_player_balance(v_uid, v_match.buy_in_amount);
    WHEN OTHERS THEN
      PERFORM public.credit_player_balance(v_uid, v_match.buy_in_amount);
      RAISE;
    END;

    PERFORM public.log_match_join_audit(p_match_id, v_uid, 'match_buyin_charged',
      format('Buy-in charged: $%s', v_match.buy_in_amount),
      jsonb_build_object('amount', v_match.buy_in_amount, 'team_number', p_team_number,
                         'idempotency_key', p_idempotency_key));
  END IF;

  IF p_set_team_pin IS NOT NULL THEN
    IF p_set_team_pin !~ '^\d{4}$' THEN
      IF v_match.buy_in_amount > 0 THEN
        PERFORM public.credit_player_balance(v_uid, v_match.buy_in_amount);
        DELETE FROM public.account_transactions
        WHERE match_id = p_match_id AND user_id = v_uid AND transaction_type = 'match_buyin';
      END IF;
      PERFORM public.log_match_join_audit(p_match_id, v_uid, 'match_join_failed',
        'Join failed: invalid PIN format', jsonb_build_object('reason','invalid_pin_format'));
      v_result := jsonb_build_object('error', 'PIN must be exactly 4 digits');
      IF v_idem_id IS NOT NULL THEN
        UPDATE public.match_join_idempotency SET result = v_result, completed_at = now() WHERE id = v_idem_id;
      END IF;
      RETURN v_result;
    END IF;
    IF v_required_pin IS NOT NULL THEN
      IF v_match.buy_in_amount > 0 THEN
        PERFORM public.credit_player_balance(v_uid, v_match.buy_in_amount);
        DELETE FROM public.account_transactions
        WHERE match_id = p_match_id AND user_id = v_uid AND transaction_type = 'match_buyin';
      END IF;
      PERFORM public.log_match_join_audit(p_match_id, v_uid, 'match_join_failed',
        'Join failed: team PIN already set',
        jsonb_build_object('reason','team_pin_exists','team_number',v_team));
      v_result := jsonb_build_object('error', 'Team already has a PIN set');
      IF v_idem_id IS NOT NULL THEN
        UPDATE public.match_join_idempotency SET result = v_result, completed_at = now() WHERE id = v_idem_id;
      END IF;
      RETURN v_result;
    END IF;

    INSERT INTO public.match_team_pins (match_id, team_number, pin, creator_id)
    VALUES (p_match_id, v_team, p_set_team_pin, v_uid);

    INSERT INTO public.match_participants (match_id, user_id, team_number)
    VALUES (p_match_id, v_uid, p_team_number);

    v_result := jsonb_build_object('success', true, 'message', 'Team PIN set and joined successfully');
    IF v_idem_id IS NOT NULL THEN
      UPDATE public.match_join_idempotency SET result = v_result, completed_at = now() WHERE id = v_idem_id;
    END IF;
    RETURN v_result;
  END IF;

  SELECT COUNT(*) FILTER (WHERE NOT success), MAX(attempted_at)
    INTO v_failed, v_last
  FROM public.pin_attempts
  WHERE user_id = v_uid AND match_id = p_match_id
    AND attempted_at > now() - INTERVAL '5 minutes';

  IF v_failed >= 5 THEN
    IF v_match.buy_in_amount > 0 THEN
      PERFORM public.credit_player_balance(v_uid, v_match.buy_in_amount);
      DELETE FROM public.account_transactions
      WHERE match_id = p_match_id AND user_id = v_uid AND transaction_type = 'match_buyin';
    END IF;
    PERFORM public.log_match_join_audit(p_match_id, v_uid, 'match_join_failed',
      'Join failed: brute-force lockout',
      jsonb_build_object('reason','pin_lockout','failed_attempts',v_failed));
    v_result := jsonb_build_object('error', 'Too many failed attempts. Please try again in 5 minutes.', 'retry_after', 300);
    IF v_idem_id IS NOT NULL THEN
      UPDATE public.match_join_idempotency SET result = v_result, completed_at = now() WHERE id = v_idem_id;
    END IF;
    RETURN v_result;
  END IF;

  IF v_failed > 0 AND v_last IS NOT NULL THEN
    v_delay := POWER(2, v_failed - 1)::INT;
    IF EXTRACT(EPOCH FROM (now() - v_last)) < v_delay THEN
      IF v_match.buy_in_amount > 0 THEN
        PERFORM public.credit_player_balance(v_uid, v_match.buy_in_amount);
        DELETE FROM public.account_transactions
        WHERE match_id = p_match_id AND user_id = v_uid AND transaction_type = 'match_buyin';
      END IF;
      PERFORM public.log_match_join_audit(p_match_id, v_uid, 'match_join_failed',
        'Join failed: throttled retry',
        jsonb_build_object('reason','pin_throttle','wait_seconds',v_delay));
      v_result := jsonb_build_object('error',
        format('Please wait %s seconds before trying again', v_delay), 'retry_after', v_delay);
      IF v_idem_id IS NOT NULL THEN
        UPDATE public.match_join_idempotency SET result = v_result, completed_at = now() WHERE id = v_idem_id;
      END IF;
      RETURN v_result;
    END IF;
  END IF;

  IF v_required_pin IS NOT NULL THEN
    IF p_pin IS NULL OR p_pin <> v_required_pin THEN
      INSERT INTO public.pin_attempts (user_id, match_id, team_number, success)
      VALUES (v_uid, p_match_id, p_team_number, false);
      IF v_match.buy_in_amount > 0 THEN
        PERFORM public.credit_player_balance(v_uid, v_match.buy_in_amount);
        DELETE FROM public.account_transactions
        WHERE match_id = p_match_id AND user_id = v_uid AND transaction_type = 'match_buyin';
      END IF;
      PERFORM public.log_match_join_audit(p_match_id, v_uid, 'match_join_failed',
        'Join failed: incorrect PIN',
        jsonb_build_object('reason','incorrect_pin','team_number',v_team));
      v_result := jsonb_build_object('error', 'Incorrect PIN');
      IF v_idem_id IS NOT NULL THEN
        UPDATE public.match_join_idempotency SET result = v_result, completed_at = now() WHERE id = v_idem_id;
      END IF;
      RETURN v_result;
    END IF;
    INSERT INTO public.pin_attempts (user_id, match_id, team_number, success)
    VALUES (v_uid, p_match_id, p_team_number, true);
  END IF;

  INSERT INTO public.match_participants (match_id, user_id, team_number)
  VALUES (p_match_id, v_uid, p_team_number);

  v_result := jsonb_build_object(
    'success', true,
    'message', CASE WHEN v_match.buy_in_amount > 0
      THEN format('Joined! $%s buy-in deducted.', v_match.buy_in_amount)
      ELSE 'Successfully joined match' END,
    'charged', v_match.buy_in_amount
  );
  IF v_idem_id IS NOT NULL THEN
    UPDATE public.match_join_idempotency SET result = v_result, completed_at = now() WHERE id = v_idem_id;
  END IF;
  RETURN v_result;
END;
$function$;