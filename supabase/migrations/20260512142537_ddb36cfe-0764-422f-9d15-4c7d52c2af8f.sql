
-- 1. New table for team PINs with strict RLS
CREATE TABLE IF NOT EXISTS public.match_team_pins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  team_number integer NOT NULL CHECK (team_number BETWEEN 1 AND 4),
  pin text NOT NULL CHECK (pin ~ '^\d{4}$'),
  creator_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (match_id, team_number)
);

CREATE INDEX IF NOT EXISTS idx_match_team_pins_match ON public.match_team_pins(match_id);
CREATE INDEX IF NOT EXISTS idx_match_team_pins_creator ON public.match_team_pins(creator_id);

ALTER TABLE public.match_team_pins ENABLE ROW LEVEL SECURITY;

-- Only the user who created the PIN (or admin) may read it directly.
-- All writes must go through SECURITY DEFINER functions.
CREATE POLICY "PIN creators or admins can view their PINs"
ON public.match_team_pins
FOR SELECT
TO authenticated
USING (creator_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Deny client inserts on match_team_pins"
ON public.match_team_pins FOR INSERT TO authenticated WITH CHECK (false);

CREATE POLICY "Deny client updates on match_team_pins"
ON public.match_team_pins FOR UPDATE TO authenticated USING (false) WITH CHECK (false);

CREATE POLICY "Deny client deletes on match_team_pins"
ON public.match_team_pins FOR DELETE TO authenticated USING (false);

-- 2. Add boolean has_pin flags on matches (safe to expose)
ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS team1_has_pin boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS team2_has_pin boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS team3_has_pin boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS team4_has_pin boolean NOT NULL DEFAULT false;

-- 3. Migrate existing PIN data
INSERT INTO public.match_team_pins (match_id, team_number, pin, creator_id)
SELECT id, 1, pin, COALESCE(team1_pin_creator, created_by)
FROM public.matches WHERE pin IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO public.match_team_pins (match_id, team_number, pin, creator_id)
SELECT id, 2, team2_pin, COALESCE(team2_pin_creator, created_by)
FROM public.matches WHERE team2_pin IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO public.match_team_pins (match_id, team_number, pin, creator_id)
SELECT id, 3, team3_pin, COALESCE(team3_pin_creator, created_by)
FROM public.matches WHERE team3_pin IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO public.match_team_pins (match_id, team_number, pin, creator_id)
SELECT id, 4, team4_pin, COALESCE(team4_pin_creator, created_by)
FROM public.matches WHERE team4_pin IS NOT NULL
ON CONFLICT DO NOTHING;

-- Set has_pin flags from existing data BEFORE dropping columns
UPDATE public.matches SET
  team1_has_pin = (pin IS NOT NULL),
  team2_has_pin = (team2_pin IS NOT NULL),
  team3_has_pin = (team3_pin IS NOT NULL),
  team4_has_pin = (team4_pin IS NOT NULL);

-- 4. Drop pin columns from matches
ALTER TABLE public.matches
  DROP COLUMN IF EXISTS pin,
  DROP COLUMN IF EXISTS team2_pin,
  DROP COLUMN IF EXISTS team3_pin,
  DROP COLUMN IF EXISTS team4_pin;

-- 5. Trigger to keep has_pin flags in sync with match_team_pins
CREATE OR REPLACE FUNCTION public.sync_match_has_pin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_match_id uuid;
  v_team integer;
  v_exists boolean;
BEGIN
  IF (TG_OP = 'DELETE') THEN
    v_match_id := OLD.match_id;
    v_team := OLD.team_number;
  ELSE
    v_match_id := NEW.match_id;
    v_team := NEW.team_number;
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM public.match_team_pins
    WHERE match_id = v_match_id AND team_number = v_team
  ) INTO v_exists;

  IF v_team = 1 THEN
    UPDATE public.matches SET team1_has_pin = v_exists WHERE id = v_match_id;
  ELSIF v_team = 2 THEN
    UPDATE public.matches SET team2_has_pin = v_exists WHERE id = v_match_id;
  ELSIF v_team = 3 THEN
    UPDATE public.matches SET team3_has_pin = v_exists WHERE id = v_match_id;
  ELSIF v_team = 4 THEN
    UPDATE public.matches SET team4_has_pin = v_exists WHERE id = v_match_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_match_has_pin ON public.match_team_pins;
CREATE TRIGGER trg_sync_match_has_pin
AFTER INSERT OR UPDATE OR DELETE ON public.match_team_pins
FOR EACH ROW EXECUTE FUNCTION public.sync_match_has_pin();

-- 6. Update get_match_team_pins to read from new table
CREATE OR REPLACE FUNCTION public.get_match_team_pins(p_match_id uuid)
RETURNS TABLE(team_number integer, pin text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_is_admin boolean;
  v_creator uuid;
BEGIN
  IF v_uid IS NULL THEN RETURN; END IF;
  SELECT created_by INTO v_creator FROM public.matches WHERE id = p_match_id;
  v_is_admin := public.has_role(v_uid, 'admin'::app_role);

  RETURN QUERY
  SELECT mtp.team_number, mtp.pin
  FROM public.match_team_pins mtp
  WHERE mtp.match_id = p_match_id
    AND (v_is_admin OR v_creator = v_uid OR mtp.creator_id = v_uid);
END;
$function$;

-- 7. New RPC: set or reset a team's PIN. Only the match creator may call it.
CREATE OR REPLACE FUNCTION public.set_match_team_pin(
  p_match_id uuid,
  p_team_number integer,
  p_pin text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_creator uuid;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('error', 'Authentication required');
  END IF;
  IF p_pin IS NULL OR p_pin !~ '^\d{4}$' THEN
    RETURN jsonb_build_object('error', 'PIN must be exactly 4 digits');
  END IF;
  IF p_team_number NOT BETWEEN 1 AND 4 THEN
    RETURN jsonb_build_object('error', 'Invalid team number');
  END IF;

  SELECT created_by INTO v_creator FROM public.matches WHERE id = p_match_id;
  IF v_creator IS NULL THEN
    RETURN jsonb_build_object('error', 'Match not found');
  END IF;
  IF v_creator <> v_uid AND NOT public.has_role(v_uid, 'admin'::app_role) THEN
    RETURN jsonb_build_object('error', 'Only the match creator can set team PINs');
  END IF;

  INSERT INTO public.match_team_pins (match_id, team_number, pin, creator_id)
  VALUES (p_match_id, p_team_number, p_pin, v_uid)
  ON CONFLICT (match_id, team_number)
  DO UPDATE SET pin = EXCLUDED.pin, creator_id = v_uid, updated_at = now();

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.set_match_team_pin(uuid, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_match_team_pin(uuid, integer, text) TO authenticated;

-- 8. Update validate_and_join_match to use match_team_pins
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
  v_team integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('error', 'Authentication required');
  END IF;

  SELECT * INTO v_match_record FROM public.matches WHERE id = p_match_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Match not found');
  END IF;

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

  SELECT COUNT(*) INTO v_participant_count
  FROM public.match_participants
  WHERE match_id = p_match_id AND status = 'active';

  IF v_participant_count >= v_match_record.max_participants THEN
    RETURN jsonb_build_object('error', 'Match is full');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.match_participants
    WHERE match_id = p_match_id AND user_id = auth.uid()
  ) THEN
    RETURN jsonb_build_object('error', 'Already joined this match');
  END IF;

  v_team := COALESCE(p_team_number, 1);
  IF v_team NOT BETWEEN 1 AND 4 THEN
    RETURN jsonb_build_object('error', 'Invalid team number');
  END IF;

  SELECT pin INTO v_required_pin
  FROM public.match_team_pins
  WHERE match_id = p_match_id AND team_number = v_team;

  -- Setting a new team PIN (first joiner on team)
  IF p_set_team_pin IS NOT NULL THEN
    IF p_set_team_pin !~ '^\d{4}$' THEN
      RETURN jsonb_build_object('error', 'PIN must be exactly 4 digits');
    END IF;
    IF v_required_pin IS NOT NULL THEN
      RETURN jsonb_build_object('error', 'Team already has a PIN set');
    END IF;

    INSERT INTO public.match_team_pins (match_id, team_number, pin, creator_id)
    VALUES (p_match_id, v_team, p_set_team_pin, auth.uid());

    INSERT INTO public.match_participants (match_id, user_id, team_number)
    VALUES (p_match_id, auth.uid(), p_team_number);

    RETURN jsonb_build_object('success', true, 'message', 'Team PIN set and joined successfully');
  END IF;

  -- Brute force protection
  SELECT 
    COUNT(*) FILTER (WHERE NOT success),
    MAX(attempted_at)
  INTO v_failed_attempts, v_last_attempt_time
  FROM public.pin_attempts
  WHERE user_id = auth.uid()
    AND match_id = p_match_id
    AND attempted_at > now() - INTERVAL '5 minutes';

  IF v_failed_attempts >= 5 THEN
    RETURN jsonb_build_object('error', 'Too many failed attempts. Please try again in 5 minutes.', 'retry_after', 300);
  END IF;

  IF v_failed_attempts > 0 AND v_last_attempt_time IS NOT NULL THEN
    v_time_since_last_attempt := now() - v_last_attempt_time;
    v_required_delay_seconds := POWER(2, v_failed_attempts - 1);
    IF EXTRACT(EPOCH FROM v_time_since_last_attempt) < v_required_delay_seconds THEN
      RETURN jsonb_build_object('error', format('Please wait %s seconds before trying again', v_required_delay_seconds), 'retry_after', v_required_delay_seconds);
    END IF;
  END IF;

  IF v_required_pin IS NOT NULL THEN
    IF p_pin IS NULL OR p_pin <> v_required_pin THEN
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

-- 9. Update validate_match_join_token to use match_team_pins
CREATE OR REPLACE FUNCTION public.validate_match_join_token(p_token text)
RETURNS TABLE(match_id uuid, team_number integer, pin text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_token_record RECORD;
  v_required_pin TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT * INTO v_token_record FROM public.match_join_tokens WHERE token = p_token FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid token';
  END IF;
  IF v_token_record.expires_at < now() THEN
    RAISE EXCEPTION 'Token has expired';
  END IF;
  IF v_token_record.used_at IS NOT NULL THEN
    RAISE EXCEPTION 'Token has already been used';
  END IF;

  UPDATE public.match_join_tokens
  SET used_at = now(), used_by = auth.uid()
  WHERE token = p_token;

  SELECT mtp.pin INTO v_required_pin
  FROM public.match_team_pins mtp
  WHERE mtp.match_id = v_token_record.match_id
    AND mtp.team_number = v_token_record.team_number;

  RETURN QUERY SELECT v_token_record.match_id, v_token_record.team_number, v_required_pin;
END;
$function$;
