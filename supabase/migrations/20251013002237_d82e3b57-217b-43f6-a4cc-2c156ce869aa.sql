-- Update finalize_match_results to skip validations for testing mode (1 player)
CREATE OR REPLACE FUNCTION public.finalize_match_results(p_match_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
  team1_score integer := 0;
  team2_score integer := 0;
  winning_team integer;
  is_testing_mode boolean := false;
BEGIN
  -- Check if already finalized
  IF EXISTS (SELECT 1 FROM public.match_results WHERE match_id = p_match_id) THEN
    RAISE NOTICE 'Results already finalized for match %', p_match_id;
    RETURN true;
  END IF;
  
  -- Acquire lock and get match details
  SELECT m.status, m.created_by, m.format, m.is_team_format, m.max_participants
  INTO match_status_check, match_creator_id, match_format_check, is_team_match, max_participants_check
  FROM public.matches m
  WHERE m.id = p_match_id
  FOR UPDATE;
  
  -- Check if testing mode (1 player)
  is_testing_mode := max_participants_check = 1;
  
  -- Double-check after lock
  IF EXISTS (SELECT 1 FROM public.match_results WHERE match_id = p_match_id) THEN
    RAISE NOTICE 'Results finalized by another process for match %', p_match_id;
    RETURN true;
  END IF;
  
  -- Security checks
  IF NOT EXISTS (
    SELECT 1 FROM public.match_participants mp 
    WHERE mp.match_id = p_match_id AND mp.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Access denied: You must be a participant to finalize results';
  END IF;
  
  IF match_status_check != 'started' THEN
    RAISE EXCEPTION 'Security violation: Can only finalize results for started matches';
  END IF;
  
  IF auth.uid() != match_creator_id THEN
    RAISE EXCEPTION 'Access denied: Only the match creator can finalize results';
  END IF;
  
  -- Skip format validations in testing mode
  IF NOT is_testing_mode THEN
    -- Validate format-specific requirements
    IF match_format_check = 'match-play' THEN
      SELECT COUNT(DISTINCT mp.user_id) INTO total_participants
      FROM public.match_participants mp
      WHERE mp.match_id = p_match_id AND mp.status = 'active';
      
      IF total_participants > 2 THEN
        RAISE EXCEPTION 'Match Play format requires exactly 2 players';
      END IF;
    END IF;
  END IF;
  
  -- Validate all participants completed 18 holes
  SELECT COUNT(DISTINCT mp.user_id) INTO total_participants
  FROM public.match_participants mp
  WHERE mp.match_id = p_match_id AND mp.status = 'active';
  
  SELECT COUNT(DISTINCT ms.player_id) INTO completed_scores_count
  FROM public.match_scores ms
  WHERE ms.match_id = p_match_id
  GROUP BY ms.player_id
  HAVING COUNT(ms.hole_number) = 18;
  
  IF completed_scores_count != total_participants THEN
    RAISE EXCEPTION 'Validation failed: Not all participants have completed 18 holes';
  END IF;
  
  -- Handle team-based formats (Scramble, Best Ball) - skip in testing mode
  IF is_team_match AND NOT is_testing_mode THEN
    -- Calculate team scores
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
      
      -- Accumulate team scores (best score per team)
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
    
    -- Determine winning team
    IF team1_score < team2_score THEN
      winning_team := 1;
    ELSIF team2_score < team1_score THEN
      winning_team := 2;
    ELSE
      winning_team := 0; -- Tie
    END IF;
    
    -- Set winners array based on winning team
    IF winning_team = 0 THEN
      -- Tie: all players are winners
      SELECT array_agg(user_id) INTO winners_array
      FROM public.match_participants
      WHERE match_id = p_match_id AND status = 'active';
    ELSE
      -- Winning team members
      SELECT array_agg(user_id) INTO winners_array
      FROM public.match_participants
      WHERE match_id = p_match_id AND status = 'active' AND team_number = winning_team;
    END IF;
    
    -- For backward compatibility, set single winner_id to first winner
    IF array_length(winners_array, 1) > 0 THEN
      winner_player_id := winners_array[1];
    END IF;
    
  ELSE
    -- Individual formats (Stroke Play, Match Play) OR testing mode
    FOR participant_record IN 
      SELECT mp.user_id, p.display_name, p.handicap
      FROM public.match_participants mp
      JOIN public.profiles p ON p.user_id = mp.user_id
      WHERE mp.match_id = p_match_id AND mp.status = 'active'
    LOOP
      player_handicap := COALESCE(participant_record.handicap, 0);
      
      IF player_handicap < -10 OR player_handicap > 54 THEN
        RAISE EXCEPTION 'Invalid handicap detected for player %: %', 
          participant_record.display_name, player_handicap;
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
      
      -- Track winners (including ties)
      IF net_score < lowest_net_score AND player_total > 0 THEN
        lowest_net_score := net_score;
        winners_array := ARRAY[participant_record.user_id];
        winner_player_id := participant_record.user_id;
      ELSIF net_score = lowest_net_score AND player_total > 0 THEN
        -- Tie: add to winners array
        winners_array := array_append(winners_array, participant_record.user_id);
      END IF;
    END LOOP;
  END IF;
  
  -- Insert match results
  INSERT INTO public.match_results (
    match_id, 
    winner_id, 
    winners,
    final_scores,
    finalized_by,
    finalized_at
  )
  VALUES (
    p_match_id, 
    winner_player_id,
    winners_array,
    final_scores_json,
    auth.uid(),
    now()
  )
  ON CONFLICT (match_id) DO NOTHING;
  
  -- Update match status
  UPDATE public.matches 
  SET status = 'completed', updated_at = now()
  WHERE id = p_match_id;
  
  -- Audit log
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
      'finalized_by', auth.uid(),
      'participant_count', total_participants
    )
  );
  
  RETURN true;
END;
$function$;