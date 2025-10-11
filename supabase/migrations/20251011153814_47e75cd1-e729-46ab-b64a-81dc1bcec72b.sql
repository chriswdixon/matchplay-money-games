-- Update the leave_match_with_dnf function to include equipment failure as non-forfeiture reason
CREATE OR REPLACE FUNCTION public.leave_match_with_dnf(
  p_match_id uuid,
  p_user_id uuid,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  active_participants_count integer;
  match_status_check text;
  result jsonb;
  participant_status text;
  is_weather_or_course boolean;
BEGIN
  -- Security: Check if user is a participant
  IF NOT EXISTS (
    SELECT 1 FROM public.match_participants 
    WHERE match_id = p_match_id AND user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'Access denied: You are not a participant in this match';
  END IF;

  -- Check if reason is weather or course-related (no forfeiture)
  is_weather_or_course := p_reason IN (
    'lightning', 'rain', 'temperature', 
    'course-closure', 'wildlife', 'equipment'
  );

  -- Check match status
  SELECT status INTO match_status_check
  FROM public.matches
  WHERE id = p_match_id;

  -- Count active participants (excluding current user)
  SELECT COUNT(*) INTO active_participants_count
  FROM public.match_participants
  WHERE match_id = p_match_id 
    AND status = 'active'
    AND user_id != p_user_id;

  -- Determine action based on active participants count
  IF active_participants_count >= 2 THEN
    -- 3+ players total (2+ remaining), mark as DNF
    UPDATE public.match_participants
    SET status = 'dnf'
    WHERE match_id = p_match_id AND user_id = p_user_id;
    
    participant_status := 'dnf';
    
    -- Log in match results as forfeited (or refunded if weather/course)
    INSERT INTO public.match_results (match_id, forfeited_players)
    VALUES (
      p_match_id,
      jsonb_build_array(
        jsonb_build_object(
          'user_id', p_user_id,
          'reason', p_reason,
          'timestamp', now(),
          'refund_eligible', is_weather_or_course
        )
      )
    )
    ON CONFLICT (match_id) 
    DO UPDATE SET 
      forfeited_players = match_results.forfeited_players || 
        jsonb_build_array(
          jsonb_build_object(
            'user_id', p_user_id,
            'reason', p_reason,
            'timestamp', now(),
            'refund_eligible', is_weather_or_course
          )
        );
    
  ELSE
    -- Less than 3 players total, everyone leaves
    -- Mark all participants as left
    UPDATE public.match_participants
    SET status = 'left'
    WHERE match_id = p_match_id;
    
    -- Cancel the match
    UPDATE public.matches
    SET status = 'cancelled'
    WHERE id = p_match_id;
    
    participant_status := 'left';
  END IF;

  result := jsonb_build_object(
    'status', participant_status,
    'remaining_players', active_participants_count,
    'match_status', CASE 
      WHEN active_participants_count >= 2 THEN match_status_check
      ELSE 'cancelled'
    END,
    'refund_eligible', is_weather_or_course
  );

  RETURN result;
END;
$$;