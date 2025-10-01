-- Enable RLS on the public_profiles view
ALTER VIEW public.public_profiles SET (security_barrier = true);

-- Drop the view and recreate it as a table-like view that supports RLS
DROP VIEW IF EXISTS public.public_profiles;

-- Create a materialized approach using a security function instead
-- This is more secure than a plain view for this use case
CREATE OR REPLACE FUNCTION public.get_public_profile(profile_user_id uuid)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  display_name text,
  handicap numeric,
  average_rating numeric,
  profile_picture_url text,
  created_at timestamp with time zone
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- Only return data if the requester is authenticated
  SELECT 
    id,
    user_id,
    display_name,
    handicap,
    average_rating,
    profile_picture_url,
    created_at
  FROM public.profiles
  WHERE user_id = profile_user_id
  AND auth.uid() IS NOT NULL; -- Require authentication
$$;

-- Grant execute permission only to authenticated users
GRANT EXECUTE ON FUNCTION public.get_public_profile TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_public_profile FROM anon;