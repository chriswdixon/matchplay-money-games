-- Drop the existing restrictive SELECT policy
DROP POLICY IF EXISTS "Users can view match participants" ON public.match_participants;

-- Create new policy allowing participants to see all participants in their matches
CREATE POLICY "Users can view match participants" 
ON public.match_participants 
FOR SELECT 
USING (
  -- User can see their own participation
  user_id = auth.uid()
  -- Match creator can see all participants
  OR is_user_match_creator(match_id, auth.uid())
  -- Match participants can see other participants in matches they're part of
  OR EXISTS (
    SELECT 1 FROM public.match_participants mp
    WHERE mp.match_id = match_participants.match_id
    AND mp.user_id = auth.uid()
  )
);