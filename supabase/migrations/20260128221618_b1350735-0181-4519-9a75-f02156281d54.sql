-- Fix: Restrict profile visibility to reduce data exposure risk
-- Users can view: their own profile, profiles of users they've matched with

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Authenticated users can view all profiles" ON profiles;

-- Create a more restrictive SELECT policy
-- Users can view:
-- 1. Their own profile
-- 2. Profiles of users who are participants in the same matches as them
CREATE POLICY "Users can view relevant profiles"
ON profiles FOR SELECT
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM match_participants mp1
    JOIN match_participants mp2 ON mp1.match_id = mp2.match_id
    WHERE mp1.user_id = auth.uid()
    AND mp2.user_id = profiles.user_id
  )
  OR has_role(auth.uid(), 'admin'::app_role)
);