-- Fix critical security vulnerability in match_results table
-- Remove the overly permissive policy that allows anyone to manipulate results

-- Drop the dangerous policy that allows unrestricted access
DROP POLICY IF EXISTS "System can manage match results" ON public.match_results;

-- The existing policy for viewing results by participants is already secure:
-- "Players can view results for matches they participate in" - this is good and should remain

-- Add audit logging for match results changes
CREATE OR REPLACE FUNCTION public.log_match_result_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Log any changes to match results for security audit
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.profile_audit_log (user_id, action, new_data)
    VALUES (
      COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid),
      'MATCH_RESULT_CREATED',
      jsonb_build_object(
        'match_id', NEW.match_id,
        'winner_id', NEW.winner_id,
        'completed_at', NEW.completed_at
      )
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.profile_audit_log (user_id, action, old_data, new_data)
    VALUES (
      COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid),
      'MATCH_RESULT_UPDATED',
      jsonb_build_object(
        'match_id', OLD.match_id,
        'winner_id', OLD.winner_id,
        'final_scores', OLD.final_scores
      ),
      jsonb_build_object(
        'match_id', NEW.match_id,
        'winner_id', NEW.winner_id,
        'final_scores', NEW.final_scores
      )
    );
    RETURN NEW;
  END IF;
  
  RETURN NULL;
END;
$$;

-- Drop and recreate trigger for audit logging
DROP TRIGGER IF EXISTS match_results_audit_trigger ON public.match_results;
CREATE TRIGGER match_results_audit_trigger
  AFTER INSERT OR UPDATE ON public.match_results
  FOR EACH ROW
  EXECUTE FUNCTION public.log_match_result_changes();

-- Ensure the finalize_match_results function has proper security
-- Update it to be more explicit about security checks
CREATE OR REPLACE FUNCTION public.finalize_match_results(match_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  participant_record RECORD;
  final_scores_json jsonb := '{}';
  player_total integer;
  lowest_score integer := 999;
  winner_player_id uuid;
  match_status_check text;
BEGIN
  -- Security: Check if user is a participant
  IF NOT EXISTS (
    SELECT 1 FROM public.match_participants mp 
    WHERE mp.match_id = finalize_match_results.match_id 
    AND mp.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Access denied: You must be a participant to finalize results';
  END IF;
  
  -- Additional security: Check match status
  SELECT status INTO match_status_check
  FROM public.matches m
  WHERE m.id = finalize_match_results.match_id;
  
  IF match_status_check != 'started' THEN
    RAISE EXCEPTION 'Security violation: Can only finalize results for started matches';
  END IF;
  
  -- Calculate total scores for each player
  FOR participant_record IN 
    SELECT mp.user_id, p.display_name
    FROM public.match_participants mp
    JOIN public.profiles p ON p.user_id = mp.user_id
    WHERE mp.match_id = finalize_match_results.match_id
  LOOP
    -- Calculate total strokes for this player
    SELECT COALESCE(SUM(strokes), 0) INTO player_total
    FROM public.match_scores ms
    WHERE ms.match_id = finalize_match_results.match_id
    AND ms.player_id = participant_record.user_id;
    
    -- Add to final scores JSON
    final_scores_json := jsonb_set(
      final_scores_json,
      ARRAY[participant_record.user_id::text],
      jsonb_build_object(
        'player_name', participant_record.display_name,
        'total_strokes', player_total
      )
    );
    
    -- Track lowest score (winner determination)
    IF player_total < lowest_score AND player_total > 0 THEN
      lowest_score := player_total;
      winner_player_id := participant_record.user_id;
    END IF;
  END LOOP;
  
  -- Securely insert or update match results
  INSERT INTO public.match_results (match_id, winner_id, final_scores)
  VALUES (finalize_match_results.match_id, winner_player_id, final_scores_json)
  ON CONFLICT (match_id) 
  DO UPDATE SET 
    winner_id = winner_player_id,
    final_scores = final_scores_json,
    updated_at = now();
  
  -- Update match status to completed
  UPDATE public.matches 
  SET status = 'completed', updated_at = now()
  WHERE id = finalize_match_results.match_id;
  
  RETURN true;
END;
$$;