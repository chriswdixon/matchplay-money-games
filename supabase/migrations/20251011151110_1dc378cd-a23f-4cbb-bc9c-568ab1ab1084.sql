-- Add status column to match_participants to track DNF (Did Not Finish)
ALTER TABLE public.match_participants 
ADD COLUMN status text NOT NULL DEFAULT 'active';

-- Add check constraint for valid status values
ALTER TABLE public.match_participants
ADD CONSTRAINT match_participants_status_check 
CHECK (status IN ('active', 'dnf', 'left'));

-- Add index for querying active participants
CREATE INDEX idx_match_participants_status 
ON public.match_participants(match_id, status);

-- Update match_results to track forfeited players
ALTER TABLE public.match_results
ADD COLUMN forfeited_players jsonb DEFAULT '[]'::jsonb;

-- Create function to handle player leaving a match
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
BEGIN
  -- Security: Check if user is a participant
  IF NOT EXISTS (
    SELECT 1 FROM public.match_participants 
    WHERE match_id = p_match_id AND user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'Access denied: You are not a participant in this match';
  END IF;

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
    
    -- Log in match results as forfeited
    INSERT INTO public.match_results (match_id, forfeited_players)
    VALUES (
      p_match_id,
      jsonb_build_array(
        jsonb_build_object(
          'user_id', p_user_id,
          'reason', p_reason,
          'timestamp', now()
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
            'timestamp', now()
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
    
    -- Note: Cancellation fee refund logic would be handled by payment processing
  END IF;

  result := jsonb_build_object(
    'status', participant_status,
    'remaining_players', active_participants_count,
    'match_status', CASE 
      WHEN active_participants_count >= 2 THEN match_status_check
      ELSE 'cancelled'
    END
  );

  RETURN result;
END;
$$;