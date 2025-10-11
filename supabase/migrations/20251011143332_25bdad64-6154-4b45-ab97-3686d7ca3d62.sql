-- Update finalize_match_results function to use handicaps and net scores
CREATE OR REPLACE FUNCTION public.finalize_match_results(p_match_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  participant_record RECORD;
  final_scores_json jsonb := '{}';
  player_total integer;
  player_handicap numeric;
  course_handicap integer;
  net_score integer;
  lowest_net_score integer := 999;
  winner_player_id uuid;
  match_status_check text;
  slope_rating integer := 113; -- Default slope rating
BEGIN
  -- Security: Check if user is a participant
  IF NOT EXISTS (
    SELECT 1 FROM public.match_participants mp 
    WHERE mp.match_id = p_match_id 
    AND mp.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Access denied: You must be a participant to finalize results';
  END IF;
  
  -- Additional security: Check match status
  SELECT m.status INTO match_status_check
  FROM public.matches m
  WHERE m.id = p_match_id;
  
  IF match_status_check != 'started' THEN
    RAISE EXCEPTION 'Security violation: Can only finalize results for started matches';
  END IF;
  
  -- Calculate total scores for each player with handicaps
  FOR participant_record IN 
    SELECT mp.user_id, p.display_name, p.handicap
    FROM public.match_participants mp
    JOIN public.profiles p ON p.user_id = mp.user_id
    WHERE mp.match_id = p_match_id
  LOOP
    -- Calculate total gross strokes for this player
    SELECT COALESCE(SUM(ms.strokes), 0) INTO player_total
    FROM public.match_scores ms
    WHERE ms.match_id = p_match_id
    AND ms.player_id = participant_record.user_id;
    
    -- Get player's handicap index (default to 0 if null)
    player_handicap := COALESCE(participant_record.handicap, 0);
    
    -- Calculate course handicap: Handicap Index × Slope Rating / 113
    course_handicap := ROUND((player_handicap * slope_rating / 113.0))::integer;
    
    -- Calculate net score (gross - course handicap)
    net_score := player_total - course_handicap;
    
    -- Add to final scores JSON with both gross and net
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
    
    -- Track lowest net score (winner determination)
    IF net_score < lowest_net_score AND player_total > 0 THEN
      lowest_net_score := net_score;
      winner_player_id := participant_record.user_id;
    END IF;
  END LOOP;
  
  -- Securely insert or update match results
  INSERT INTO public.match_results (match_id, winner_id, final_scores)
  VALUES (p_match_id, winner_player_id, final_scores_json)
  ON CONFLICT (match_id) 
  DO UPDATE SET 
    winner_id = winner_player_id,
    final_scores = final_scores_json,
    updated_at = now();
  
  -- Update match status to completed
  UPDATE public.matches 
  SET status = 'completed', updated_at = now()
  WHERE id = p_match_id;
  
  RETURN true;
END;
$function$;