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
    mp_diff := mp_p1_holes_won - mp_p2_holes_won;
    mp_is_clinched := abs(mp_diff) > mp_holes_remaining;

    IF NOT mp_is_clinched AND mp_holes_remaining > 0 THEN
      RAISE EXCEPTION 'Match Play not yet decided: % to %, % holes remaining', mp_p1_holes_won, mp_p2_holes_won, mp_holes_remaining;
    END IF;

    FOR participant_record IN
      SELECT mp.user_id, p.display_name, p.handicap
      FROM public.match_participants mp
      JOIN public.profiles p ON p.user_id = mp.user_id
      WHERE mp.match_id = p_match_id AND mp.status = 'active'
    LOOP
      SELECT COALESCE(SUM(ms.strokes), 0) INTO player_total
      FROM public.match_scores ms
      WHERE ms.match_id = p_match_id AND ms.player_id = participant_record.user_id;

      final_scores_json := jsonb_set(
        final_scores_json,
        ARRAY[participant_record.user_id::text],
        jsonb_build_object(
          'player_name', participant_record.display_name,
          'gross_strokes', player_total,
          'handicap_index', COALESCE(participant_record.handicap, 0),
          'holes_won', CASE WHEN participant_record.user_id = mp_p1 THEN mp_p1_holes_won ELSE mp_p2_holes_won END,
          'match_play_result', CASE
            WHEN mp_diff = 0 THEN 'AS'
            WHEN (participant_record.user_id = mp_p1 AND mp_diff > 0)
              OR (participant_record.user_id = mp_p2 AND mp_diff < 0) THEN
                CASE WHEN mp_holes_remaining > 0
                  THEN abs(mp_diff)::text || '&' || mp_holes_remaining::text
                  ELSE abs(mp_diff)::text || ' UP' END
            ELSE 'lost'
          END
        )
      );
    END LOOP;

    IF mp_diff > 0 THEN
      winners_array := ARRAY[mp_p1];
      winner_player_id := mp_p1;
    ELSIF mp_diff < 0 THEN
      winners_array := ARRAY[mp_p2];
      winner_player_id := mp_p2;
    ELSE
      winners_array := ARRAY[mp_p1, mp_p2];
      winner_player_id := mp_p1;
    END IF;
  ELSE
    SELECT COUNT(DISTINCT mp.user_id) INTO total_participants
    FROM public.match_participants mp
    WHERE mp.match_id = p_match_id AND mp.status = 'active';

    SELECT COUNT(*) INTO completed_scores_count
    FROM (
      SELECT ms.player_id
      FROM public.match_scores ms
      WHERE ms.match_id = p_match_id
      GROUP BY ms.player_id
      HAVING COUNT(ms.hole_number) = total_holes
    ) sub;

    IF completed_scores_count != total_participants THEN
      RAISE EXCEPTION 'Validation failed: Not all participants have completed % holes', total_holes;
    END IF;

    IF is_team_match AND NOT is_testing_mode THEN
      FOR team_record IN
        SELECT mp.team_number, p.user_id, p.display_name, p.handicap
        FROM public.match_participants mp
        JOIN public.profiles p ON p.user_id = mp.user_id
        WHERE mp.match_id = p_match_id AND mp.status = 'active' AND mp.team_number IS NOT NULL
        ORDER BY mp.team_number
      LOOP
        player_handicap := COALESCE(team_record.handicap, 0);

        SELECT COALESCE(SUM(ms.strokes), 0) INTO player_total
        FROM public.match_scores ms
        WHERE ms.match_id = p_match_id AND ms.player_id = team_record.user_id;

        course_handicap := ROUND((player_handicap * slope_rating / 113.0))::integer;
        net_score := player_total - course_handicap;

        final_scores_json := jsonb_set(
          final_scores_json,
          ARRAY[team_record.user_id::text],
          jsonb_build_object(
            'player_name', team_record.display_name,
            'gross_strokes', player_total,
            'handicap_index', player_handicap,
            'course_handicap', course_handicap,
            'net_strokes', net_score,
            'team_number', team_record.team_number
          )
        );

        IF team_record.team_number = 1 THEN
          IF team1_score = 0 OR net_score < team1_score THEN
            team1_score := net_score;
          END IF;
        ELSIF team_record.team_number = 2 THEN
          IF team2_score = 0 OR net_score < team2_score THEN
            team2_score := net_score;
          END IF;
        END IF;
      END LOOP;

      IF team1_score < team2_score THEN
        winning_team := 1;
      ELSIF team2_score < team1_score THEN
        winning_team := 2;
      ELSE
        winning_team := 0;
      END IF;

      IF winning_team = 0 THEN
        SELECT array_agg(user_id) INTO winners_array
        FROM public.match_participants
        WHERE match_id = p_match_id AND status = 'active';
      ELSE
        SELECT array_agg(user_id) INTO winners_array
        FROM public.match_participants
        WHERE match_id = p_match_id AND status = 'active' AND team_number = winning_team;
      END IF;

      IF array_length(winners_array, 1) > 0 THEN
        winner_player_id := winners_array[1];
      END IF;
    ELSE
      FOR participant_record IN
        SELECT mp.user_id, p.display_name, p.handicap
        FROM public.match_participants mp
        JOIN public.profiles p ON p.user_id = mp.user_id
        WHERE mp.match_id = p_match_id AND mp.status = 'active'
      LOOP
        player_handicap := COALESCE(participant_record.handicap, 0);

        IF player_handicap < -10 OR player_handicap > 54 THEN
          RAISE EXCEPTION 'Invalid handicap detected for player %: %', participant_record.display_name, player_handicap;
        END IF;

        SELECT COALESCE(SUM(ms.strokes), 0) INTO player_total
        FROM public.match_scores ms
        WHERE ms.match_id = p_match_id AND ms.player_id = participant_record.user_id;

        course_handicap := ROUND((player_handicap * slope_rating / 113.0))::integer;
        net_score := player_total - course_handicap;

        final_scores_json := jsonb_set(
          final_scores_json,
          ARRAY[participant_record.user_id::text],
          jsonb_build_object(
            'player_name', participant_record.display_name,
            'gross_strokes', player_total,
            'handicap_index', player_handicap,
            'course_handicap', course_handicap,
            'net_strokes', net_score
          )
        );

        IF net_score < lowest_net_score AND player_total > 0 THEN
          lowest_net_score := net_score;
          winners_array := ARRAY[participant_record.user_id];
          winner_player_id := participant_record.user_id;
        ELSIF net_score = lowest_net_score AND player_total > 0 THEN
          winners_array := array_append(winners_array, participant_record.user_id);
        END IF;
      END LOOP;
    END IF;
  END IF;

  INSERT INTO public.match_results (match_id, winner_id, winners, final_scores, finalized_by, finalized_at)
  VALUES (p_match_id, winner_player_id, winners_array, final_scores_json, auth.uid(), now())
  ON CONFLICT (match_id) DO NOTHING;

  UPDATE public.matches SET status = 'completed', updated_at = now() WHERE id = p_match_id;

  INSERT INTO public.profile_audit_log (user_id, action, new_data)
  VALUES (
    auth.uid(),
    'MATCH_RESULTS_FINALIZED',
    jsonb_build_object(
      'match_id', p_match_id,
      'winner_id', winner_player_id,
      'winners', winners_array,
      'is_team_format', is_team_match,
      'is_testing_mode', is_testing_mode,
      'format', match_format_check,
      'finalized_by', auth.uid()
    )
  );

  RETURN true;
END;
$func$;