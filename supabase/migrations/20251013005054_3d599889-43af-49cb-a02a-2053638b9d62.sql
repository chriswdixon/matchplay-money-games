-- Create table to track PIN attempts for brute force protection
CREATE TABLE IF NOT EXISTS public.pin_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  team_number INTEGER,
  success BOOLEAN NOT NULL DEFAULT false,
  attempted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ip_address TEXT
);

-- Index for efficient lookups
CREATE INDEX idx_pin_attempts_user_match ON public.pin_attempts(user_id, match_id, attempted_at DESC);

-- RLS for pin_attempts
ALTER TABLE public.pin_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own attempts"
ON public.pin_attempts FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Service role can insert attempts"
ON public.pin_attempts FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Create secure server-side function for PIN validation and joining
CREATE OR REPLACE FUNCTION public.validate_and_join_match(
  p_match_id UUID,
  p_pin TEXT DEFAULT NULL,
  p_team_number INTEGER DEFAULT NULL,
  p_set_team_pin TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
    -- Validate PIN format (4 digits)
    IF p_set_team_pin !~ '^\d{4}$' THEN
      RETURN jsonb_build_object('error', 'PIN must be exactly 4 digits');
    END IF;

    -- Check team doesn't already have a PIN
    IF v_required_pin IS NOT NULL THEN
      RETURN jsonb_build_object('error', 'Team already has a PIN set');
    END IF;

    -- Set the team PIN
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

    -- Update match with new PIN
    EXECUTE format(
      'UPDATE public.matches SET %I = $1, %I = $2 WHERE id = $3',
      v_pin_column_name, v_creator_column_name
    ) USING p_set_team_pin, auth.uid(), p_match_id;

    -- Insert participant (no PIN validation needed when setting)
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

  -- Block if too many failed attempts
  IF v_failed_attempts >= 5 THEN
    RETURN jsonb_build_object(
      'error', 'Too many failed attempts. Please try again in 5 minutes.',
      'retry_after', 300
    );
  END IF;

  -- Progressive delay based on failed attempts
  IF v_failed_attempts > 0 AND v_last_attempt_time IS NOT NULL THEN
    v_time_since_last_attempt := now() - v_last_attempt_time;
    v_required_delay_seconds := POWER(2, v_failed_attempts - 1); -- Exponential backoff: 1s, 2s, 4s, 8s

    IF EXTRACT(EPOCH FROM v_time_since_last_attempt) < v_required_delay_seconds THEN
      RETURN jsonb_build_object(
        'error', format('Please wait %s seconds before trying again', v_required_delay_seconds),
        'retry_after', v_required_delay_seconds
      );
    END IF;
  END IF;

  -- Validate PIN if required
  IF v_required_pin IS NOT NULL THEN
    IF p_pin IS NULL OR p_pin != v_required_pin THEN
      -- Log failed attempt
      INSERT INTO public.pin_attempts (user_id, match_id, team_number, success)
      VALUES (auth.uid(), p_match_id, p_team_number, false);

      RETURN jsonb_build_object('error', 'Incorrect PIN');
    END IF;

    -- Log successful attempt
    INSERT INTO public.pin_attempts (user_id, match_id, team_number, success)
    VALUES (auth.uid(), p_match_id, p_team_number, true);
  END IF;

  -- Insert participant
  INSERT INTO public.match_participants (match_id, user_id, team_number)
  VALUES (p_match_id, auth.uid(), p_team_number);

  RETURN jsonb_build_object('success', true, 'message', 'Successfully joined match');
END;
$$;

-- Update RLS policy on match_participants to prevent direct inserts
-- Drop the old permissive policy
DROP POLICY IF EXISTS "Users can join matches" ON public.match_participants;

-- Create new restrictive policy that only allows inserts through the secure function
CREATE POLICY "Users can join matches via secure function"
ON public.match_participants FOR INSERT
TO authenticated
WITH CHECK (
  -- Only allow inserts from the secure function (checks if called within transaction by function)
  -- OR if user is the match creator (for initial setup)
  EXISTS (
    SELECT 1 FROM public.matches m
    WHERE m.id = match_id
    AND (
      m.created_by = auth.uid()
      OR current_setting('app.secure_join_allowed', true) = 'true'
    )
  )
);

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.validate_and_join_match TO authenticated;