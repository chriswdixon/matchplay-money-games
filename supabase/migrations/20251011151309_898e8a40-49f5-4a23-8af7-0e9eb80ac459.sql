-- Update the get_match_participant_count function to only count active participants
CREATE OR REPLACE FUNCTION public.get_match_participant_count(match_id uuid)
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT COUNT(*)::INTEGER
  FROM public.match_participants
  WHERE match_participants.match_id = get_match_participant_count.match_id
    AND match_participants.status = 'active';
$$;