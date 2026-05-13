CREATE OR REPLACE FUNCTION public.start_match_with_current_players(match_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_active_count int;
  v_match RECORD;
BEGIN
  -- Caller must be a participant
  IF NOT EXISTS (
    SELECT 1 FROM public.match_participants mp
    WHERE mp.match_id = start_match_with_current_players.match_id
      AND mp.user_id = auth.uid()
      AND mp.status = 'active'
  ) THEN
    RAISE EXCEPTION 'You must be an active participant to start this match';
  END IF;

  SELECT * INTO v_match FROM public.matches WHERE id = start_match_with_current_players.match_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Match not found';
  END IF;

  IF v_match.status <> 'open' THEN
    RAISE EXCEPTION 'Match is not open';
  END IF;

  -- Disallow for team formats (would break team configuration)
  IF COALESCE(v_match.is_team_format, false) THEN
    RAISE EXCEPTION 'Cannot resize a team-format match';
  END IF;

  SELECT COUNT(*) INTO v_active_count
  FROM public.match_participants mp
  WHERE mp.match_id = start_match_with_current_players.match_id
    AND mp.status = 'active';

  IF v_active_count < 2 THEN
    RAISE EXCEPTION 'At least 2 players are required to start a match';
  END IF;

  UPDATE public.matches
  SET max_participants = v_active_count,
      status = 'started',
      updated_at = now()
  WHERE id = start_match_with_current_players.match_id
    AND status = 'open';

  RETURN FOUND;
END;
$function$;