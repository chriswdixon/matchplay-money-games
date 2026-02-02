-- Fix infinite recursion in match_participants RLS SELECT policy
-- The current policy queries match_participants from within a match_participants policy

-- Drop the problematic SELECT policy
DROP POLICY IF EXISTS "Users can view match participants" ON match_participants;

-- Create a security definer function to check if user is in a match
CREATE OR REPLACE FUNCTION public.is_user_in_match(p_match_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM match_participants
    WHERE match_id = p_match_id
      AND user_id = p_user_id
  )
$$;

-- Create new SELECT policy using the security definer function
CREATE POLICY "Users can view match participants"
ON match_participants
FOR SELECT
USING (
  user_id = auth.uid() 
  OR is_user_match_creator(match_id, auth.uid()) 
  OR is_user_in_match(match_id, auth.uid())
);