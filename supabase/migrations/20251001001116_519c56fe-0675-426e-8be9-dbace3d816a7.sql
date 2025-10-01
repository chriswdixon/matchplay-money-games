-- Allow authenticated users to view other players' profiles
-- Drop the overly restrictive SELECT policy
DROP POLICY IF EXISTS "Users can view only their own profile" ON public.profiles;

-- Add a new policy that allows authenticated users to view all profiles
-- This enables viewing other players' Display Name, handicap, and rating
CREATE POLICY "Authenticated users can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);