CREATE OR REPLACE FUNCTION public.validate_and_join_match(p_match_id uuid, p_pin text DEFAULT NULL::text, p_team_number integer DEFAULT NULL::integer, p_set_team_pin text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_match_record RECORD;
  v_required_pin TEXT;
  v_failed_attempts INTEGER;
  v_last_attempt_time TIMESTAMP WITH TIME ZONE;
  v_time_since_last_attempt INTERVAL;
  v_required_delay_seconds INTEGER;
  v_participant_count INTEGER;
  v_pin_column_name TEXT;
  v_creator_column_name TEXT;
BEGIN
  -- Security: Verify user is authenticated
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('error', 'Authentication required');
  END IF;

  -- Fetch match details
  SELECT * INTO v_match_record
  FROM public.matches
  WHERE id = p_match_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Match not found');
  END IF;

  -- Block joining matches that are not open (cancelled, started, completed, etc.)
  IF v_match_record.status <> 'open' THEN
    RETURN jsonb_build_object(
      'error',
      CASE v_match_record.status
        WHEN 'cancelled' THEN 'This match has been cancelled and can no longer be joined'
        WHEN 'started'   THEN 'This match has already started and is no longer accepting players'
        WHEN 'completed' THEN 'This match has already been completed'
        ELSE 'This match is no longer open for new players'
      END
    );
  END IF;

  -- Check if match is full
  SELECT COUNT(*) INTO v_participant_count
  FROM public.match_participants
  WHERE match_id = p_match_id AND status = 'active';

  IF v_participant_count >= v_match_record.max_participants THEN
    RETURN jsonb_build_object('error', 'Match is full');
  END IF;

  -- Check if user already joined
  IF EXISTS (
    SELECT 1 FROM public.match_participants
    WHERE match_id = p_match_id AND user_id = auth.uid()
  ) THEN
    RETURN jsonb_build_object('error', 'Already joined this match');
  END IF;

  -- Determine required PIN based on team number
  IF p_team_number = 1 OR p_team_number IS NULL THEN
    v_required_pin := v_match_record.pin;
  ELSIF p_team_number = 2 THEN
    v_required_pin := v_match_record.team2_pin;
  ELSIF p_team_number = 3 THEN
    v_required_pin := v_match_record.team3_pin;
  ELSIF p_team_number = 4 THEN
    v_required_pin := v_match_record.team4_pin;
  ELSE
    RETURN jsonb_build_object('error', 'Invalid team number');
  END IF;

  -- If setting a new team PIN (first joiner on team)
  IF p_set_team_pin IS NOT NULL THEN
    IF p_set_team_pin !~ '^\d{4}$' THEN
      RETURN jsonb_build_object('error', 'PIN must be exactly 4 digits');
    END IF;

    IF v_required_pin IS NOT NULL THEN
      RETURN jsonb_build_object('error', 'Team already has a PIN set');
    END IF;

    IF p_team_number = 1 OR p_team_number IS NULL THEN
      v_pin_column_name := 'pin';
      v_creator_column_name := 'team1_pin_creator';
    ELSIF p_team_number = 2 THEN
      v_pin_column_name := 'team2_pin';
      v_creator_column_name := 'team2_pin_creator';
    ELSIF p_team_number = 3 THEN
      v_pin_column_name := 'team3_pin';
      v_creator_column_name := 'team3_pin_creator';
    ELSIF p_team_number = 4 THEN
      v_pin_column_name := 'team4_pin';
      v_creator_column_name := 'team4_pin_creator';
    END IF;

    EXECUTE format(
      'UPDATE public.matches SET %I = $1, %I = $2 WHERE id = $3',
      v_pin_column_name, v_creator_column_name
    ) USING p_set_team_pin, auth.uid(), p_match_id;

    INSERT INTO public.match_participants (match_id, user_id, team_number)
    VALUES (p_match_id, auth.uid(), p_team_number);

    RETURN jsonb_build_object('success', true, 'message', 'Team PIN set and joined successfully');
  END IF;

  -- BRUTE FORCE PROTECTION: Check failed attempts in last 5 minutes
  SELECT 
    COUNT(*) FILTER (WHERE NOT success),
    MAX(attempted_at)
  INTO v_failed_attempts, v_last_attempt_time
  FROM public.pin_attempts
  WHERE user_id = auth.uid()
    AND match_id = p_match_id
    AND attempted_at > now() - INTERVAL '5 minutes';

  IF v_failed_attempts >= 5 THEN
    RETURN jsonb_build_object(
      'error', 'Too many failed attempts. Please try again in 5 minutes.',
      'retry_after', 300
    );
  END IF;

  IF v_failed_attempts > 0 AND v_last_attempt_time IS NOT NULL THEN
    v_time_since_last_attempt := now() - v_last_attempt_time;
    v_required_delay_seconds := POWER(2, v_failed_attempts - 1);

    IF EXTRACT(EPOCH FROM v_time_since_last_attempt) < v_required_delay_seconds THEN
      RETURN jsonb_build_object(
        'error', format('Please wait %s seconds before trying again', v_required_delay_seconds),
        'retry_after', v_required_delay_seconds
      );
    END IF;
  END IF;

  IF v_required_pin IS NOT NULL THEN
    IF p_pin IS NULL OR p_pin != v_required_pin THEN
      INSERT INTO public.pin_attempts (user_id, match_id, team_number, success)
      VALUES (auth.uid(), p_match_id, p_team_number, false);

      RETURN jsonb_build_object('error', 'Incorrect PIN');
    END IF;

    INSERT INTO public.pin_attempts (user_id, match_id, team_number, success)
    VALUES (auth.uid(), p_match_id, p_team_number, true);
  END IF;

  INSERT INTO public.match_participants (match_id, user_id, team_number)
  VALUES (p_match_id, auth.uid(), p_team_number);

  RETURN jsonb_build_object('success', true, 'message', 'Successfully joined match');
END;
$function$;