-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Authenticated users can view all profiles" ON public.profiles;

-- Restore the original restrictive policy for the profiles table
-- Users can only see their full profile (including membership_tier)
CREATE POLICY "Users can view only their own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Create a public view that exposes only non-sensitive profile fields
CREATE OR REPLACE VIEW public.public_profiles AS
SELECT 
  id,
  user_id,
  display_name,
  handicap,
  average_rating,
  profile_picture_url,
  created_at
FROM public.profiles;

-- Grant SELECT permission on the view to authenticated users
GRANT SELECT ON public.public_profiles TO authenticated;