-- Fix profiles table visibility for match functionality
-- Allow authenticated users to view basic profile information needed for golf matches
-- Sensitive data remains protected in private_profile_data table

-- Drop the overly restrictive SELECT policy
DROP POLICY IF EXISTS "Users can view only their own profile" ON public.profiles;

-- Create new SELECT policy allowing authenticated users to view all profiles
-- This is safe because sensitive data (phone, etc.) is in private_profile_data
CREATE POLICY "Authenticated users can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

-- Keep existing restrictive policies for modifications
-- (INSERT and UPDATE policies remain unchanged - users can only modify their own)