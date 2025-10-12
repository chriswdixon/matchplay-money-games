-- Fix 1: Add database-level handicap validation
-- Prevents direct database manipulation of handicap values outside acceptable range

-- Add CHECK constraint for handicap range
ALTER TABLE public.profiles 
ADD CONSTRAINT valid_handicap_range 
CHECK (handicap IS NULL OR (handicap >= -10 AND handicap <= 54));

-- Add validation trigger as additional layer
CREATE OR REPLACE FUNCTION public.validate_handicap()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.handicap IS NOT NULL AND (NEW.handicap < -10 OR NEW.handicap > 54) THEN
    RAISE EXCEPTION 'Handicap must be between -10 and 54';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER check_handicap_before_insert_or_update
BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.validate_handicap();

-- Fix 2: Prevent race conditions in match finalization
-- Add row-level locking and idempotency checks

DROP FUNCTION IF EXISTS public.finalize_match_results(uuid) CASCADE;

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
  slope_rating integer := 113;
  total_participants integer;
  completed_scores_count integer;
  match_creator_id uuid;
BEGIN
  -- CRITICAL: Add row-level lock to prevent concurrent execution
  SELECT m.status, m.created_by INTO match_status_check, match_creator_id
  FROM public.matches m
  WHERE m.id = p_match_id
  FOR UPDATE;  -- Lock the row to prevent concurrent finalization
  
  -- Idempotency Check: If results already exist, return early
  IF EXISTS (SELECT 1 FROM public.match_results WHERE match_id = p_match_id) THEN
    RAISE NOTICE 'Results already finalized for match %', p_match_id;
    RETURN true;
  END IF;
  
  -- Security Check 1: Verify user is a participant
  IF NOT EXISTS (
    SELECT 1 FROM public.match_participants mp 
    WHERE mp.match_id = p_match_id 
    AND mp.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Access denied: You must be a participant to finalize results';
  END IF;
  
  -- Security Check 2: Verify match status
  IF match_status_check != 'started' THEN
    RAISE EXCEPTION 'Security violation: Can only finalize results for started matches';
  END IF;
  
  -- Security Check 3: Verify only match creator can finalize
  IF auth.uid() != match_creator_id THEN
    RAISE EXCEPTION 'Access denied: Only the match creator can finalize results';
  END IF;
  
  -- Validation Check 1: Verify all participants have completed all 18 holes
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
  
  -- Calculate total scores for each player with handicaps
  FOR participant_record IN 
    SELECT mp.user_id, p.display_name, p.handicap
    FROM public.match_participants mp
    JOIN public.profiles p ON p.user_id = mp.user_id
    WHERE mp.match_id = p_match_id AND mp.status = 'active'
  LOOP
    -- Get player's handicap and validate it's reasonable
    player_handicap := COALESCE(participant_record.handicap, 0);
    
    -- Validation Check 2: Reject unreasonable handicaps (enforced by trigger now)
    IF player_handicap < -10 OR player_handicap > 54 THEN
      RAISE EXCEPTION 'Invalid handicap detected for player %: %. Handicaps must be between -10 and 54.', 
        participant_record.display_name, player_handicap;
    END IF;
    
    -- Calculate total gross strokes
    SELECT COALESCE(SUM(ms.strokes), 0) INTO player_total
    FROM public.match_scores ms
    WHERE ms.match_id = p_match_id
    AND ms.player_id = participant_record.user_id;
    
    -- Calculate course handicap and net score
    course_handicap := ROUND((player_handicap * slope_rating / 113.0))::integer;
    net_score := player_total - course_handicap;
    
    -- Build final scores JSON
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
    
    -- Determine winner (lowest net score)
    IF net_score < lowest_net_score AND player_total > 0 THEN
      lowest_net_score := net_score;
      winner_player_id := participant_record.user_id;
    ELSIF net_score = lowest_net_score THEN
      -- Handle ties: keep first player found with this score
      IF winner_player_id IS NULL THEN
        winner_player_id := participant_record.user_id;
      END IF;
    END IF;
  END LOOP;
  
  -- Securely insert match results (ON CONFLICT prevents duplicates)
  INSERT INTO public.match_results (
    match_id, 
    winner_id, 
    final_scores,
    finalized_by,
    finalized_at
  )
  VALUES (
    p_match_id, 
    winner_player_id, 
    final_scores_json,
    auth.uid(),
    now()
  )
  ON CONFLICT (match_id) DO NOTHING;  -- Idempotency: don't update if already exists
  
  -- Update match status to completed
  UPDATE public.matches 
  SET status = 'completed', updated_at = now()
  WHERE id = p_match_id;
  
  -- Audit log the finalization
  INSERT INTO public.profile_audit_log (user_id, action, new_data)
  VALUES (
    auth.uid(),
    'MATCH_RESULTS_FINALIZED',
    jsonb_build_object(
      'match_id', p_match_id,
      'winner_id', winner_player_id,
      'finalized_by', auth.uid(),
      'participant_count', total_participants
    )
  );
  
  RETURN true;
END;
$function$;