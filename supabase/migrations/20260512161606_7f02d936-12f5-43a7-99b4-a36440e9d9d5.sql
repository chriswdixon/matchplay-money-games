CREATE OR REPLACE FUNCTION public.finalize_match_results(p_match_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $func$
DECLARE
  participant_record RECORD;
  team_record RECORD;
  final_scores_json jsonb := '{}';
  player_total integer;
  player_handicap numeric;
  course_handicap integer;
  net_score integer;
  lowest_net_score integer := 999;
  winner_player_id uuid;
  winners_array uuid[] := ARRAY[]::uuid[];
  match_status_check text;
  match_format_check text;
  is_team_match boolean;
  slope_rating integer := 113;
  total_participants integer;
  completed_scores_count integer;
  match_creator_id uuid;
  max_participants_check integer;
  total_holes integer;
  team1_score integer := 0;
  team2_score integer := 0;
  winning_team integer;
  is_testing_mode boolean := false;
  mp_p1 uuid;
  mp_p2 uuid;
  mp_p1_holes_won integer := 0;
  mp_p2_holes_won integer := 0;
  mp_holes_played integer := 0;
  mp_holes_remaining integer := 0;
  mp_diff integer := 0;
  mp_is_clinched boolean := false;
  hole_record RECORD;
  active_count integer;
BEGIN
  IF EXISTS (SELECT 1 FROM public.match_results WHERE match_id = p_match_id) THEN
    RETURN true;
  END IF;

  SELECT m.status, m.created_by, m.format, m.is_team_format, m.max_participants, COALESCE(m.holes, 18)
  INTO match_status_check, match_creator_id, match_format_check, is_team_match, max_participants_check, total_holes
  FROM public.matches m
  WHERE m.id = p_match_id
  FOR UPDATE;

  is_testing_mode := max_participants_check = 1;

  IF EXISTS (SELECT 1 FROM public.match_results WHERE match_id = p_match_id) THEN
    RETURN true;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.match_participants mp
    WHERE mp.match_id = p_match_id AND mp.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Access denied: You must be a participant to finalize results';
  END IF;

  -- Auto-promote 'open' match to 'started' when finalize is being attempted
  -- (allows per-player completion flow to finalize even if start_match was never explicitly called)
  IF match_status_check = 'open' THEN
    SELECT COUNT(*) INTO active_count
    FROM public.match_participants mp
    WHERE mp.match_id = p_match_id AND mp.status = 'active';

    IF is_testing_mode OR active_count >= max_participants_check THEN
      UPDATE public.matches
      SET status = 'started', updated_at = now()
      WHERE id = p_match_id AND status = 'open';
      match_status_check := 'started';
    END IF;
  END IF;

  IF match_status_check != 'started' THEN
    RAISE EXCEPTION 'Security violation: Can only finalize results for started matches';
  END IF;

  IF NOT is_testing_mode AND match_format_check = 'match-play' THEN
    SELECT COUNT(DISTINCT mp.user_id) INTO total_participants
    FROM public.match_participants mp
    WHERE mp.match_id = p_match_id AND mp.status = 'active';
    IF total_participants > 2 THEN
      RAISE EXCEPTION 'Match Play format requires exactly 2 players';
    END IF;
  END IF;

  IF match_format_check = 'match-play' AND NOT is_team_match AND NOT is_testing_mode THEN
    SELECT array_agg(user_id ORDER BY user_id) INTO winners_array
    FROM public.match_participants
    WHERE match_id = p_match_id AND status = 'active';
    IF array_length(winners_array, 1) <> 2 THEN
      RAISE EXCEPTION 'Match Play requires exactly 2 active players';
    END IF;
    mp_p1 := winners_array[1];
    mp_p2 := winners_array[2];
    winners_array := ARRAY[]::uuid[];

    FOR hole_record IN
      SELECT hole_number,
             MAX(CASE WHEN player_id = mp_p1 THEN strokes END) AS p1_strokes,
             MAX(CASE WHEN player_id = mp_p2 THEN strokes END) AS p2_strokes
      FROM public.match_scores
      WHERE match_id = p_match_id
      GROUP BY hole_number
      ORDER BY hole_number
    LOOP
      IF hole_record.p1_strokes IS NOT NULL AND hole_record.p2_strokes IS NOT NULL THEN
        mp_holes_played := mp_holes_played + 1;
        IF hole_record.p1_strokes < hole_record.p2_strokes THEN
          mp_p1_holes_won := mp_p1_holes_won + 1;
        ELSIF hole_record.p2_strokes < hole_record.p1_strokes THEN
          mp_p2_holes_won := mp_p2_holes_won + 1;
        END IF;
      END IF;
    END LOOP;

    mp_holes_remaining := total_holes - mp_holes_played;
    mp_diff := abs(mp_p1_holes_won - mp_p2_holes_won);
    mp_is_clinched := mp_diff > mp_holes_remaining;

    final_scores_json := jsonb_build_object(
      'format', 'match-play',
      'p1', mp_p1, 'p2', mp_p2,
      'p1_holes_won', mp_p1_holes_won,
      'p2_holes_won', mp_p2_holes_won,
      'holes_played', mp_holes_played,
      'holes_remaining', mp_holes_remaining,
      'clinched', mp_is_clinched
    );

    IF mp_p1_holes_won > mp_p2_holes_won THEN
      winners_array := ARRAY[mp_p1];
    ELSIF mp_p2_holes_won > mp_p1_holes_won THEN
      winners_array := ARRAY[mp_p2];
    ELSE
      winners_array := ARRAY[mp_p1, mp_p2];
    END IF;

    INSERT INTO public.match_results (match_id, winner_id, winners, final_scores, finalized_at, finalized_by)
    VALUES (p_match_id, winners_array[1], winners_array, final_scores_json, now(), auth.uid());

    UPDATE public.matches SET status = 'completed', updated_at = now() WHERE id = p_match_id;
    RETURN true;
  END IF;

  -- Stroke play / team / other formats: lowest net wins, ties split
  FOR participant_record IN
    SELECT mp.user_id, mp.team_number, COALESCE(p.handicap, 0) AS handicap
    FROM public.match_participants mp
    LEFT JOIN public.profiles p ON p.user_id = mp.user_id
    WHERE mp.match_id = p_match_id AND mp.status = 'active'
  LOOP
    SELECT COALESCE(SUM(strokes), 0) INTO player_total
    FROM public.match_scores
    WHERE match_id = p_match_id AND player_id = participant_record.user_id;

    course_handicap := round(participant_record.handicap * (slope_rating::numeric / 113));
    net_score := player_total - course_handicap;

    final_scores_json := final_scores_json || jsonb_build_object(
      participant_record.user_id::text,
      jsonb_build_object('gross', player_total, 'net', net_score, 'team', participant_record.team_number)
    );

    IF net_score < lowest_net_score THEN
      lowest_net_score := net_score;
      winners_array := ARRAY[participant_record.user_id];
    ELSIF net_score = lowest_net_score THEN
      winners_array := winners_array || participant_record.user_id;
    END IF;
  END LOOP;

  INSERT INTO public.match_results (match_id, winner_id, winners, final_scores, finalized_at, finalized_by)
  VALUES (p_match_id, winners_array[1], winners_array, final_scores_json, now(), auth.uid());

  UPDATE public.matches SET status = 'completed', updated_at = now() WHERE id = p_match_id;
  RETURN true;
END;
$func$;