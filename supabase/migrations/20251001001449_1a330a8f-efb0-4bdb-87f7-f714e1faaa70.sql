-- Recreate the view with SECURITY INVOKER to avoid the security warning
-- This makes the view run with the privileges of the user querying it
DROP VIEW IF EXISTS public.public_profiles;

CREATE OR REPLACE VIEW public.public_profiles
WITH (security_invoker = true) AS
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