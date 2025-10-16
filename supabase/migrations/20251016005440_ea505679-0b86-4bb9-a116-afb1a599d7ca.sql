-- Function to check if email is from match-play.co domain
CREATE OR REPLACE FUNCTION public.is_match_play_email(email TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT email LIKE '%@match-play.co';
$$;

-- Trigger function to auto-grant admin role to match-play.co users
CREATE OR REPLACE FUNCTION public.auto_grant_admin_to_match_play()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_email TEXT;
BEGIN
  -- Get the user's email from auth.users
  SELECT email INTO user_email
  FROM auth.users
  WHERE id = NEW.user_id;

  -- If email is from match-play.co domain, grant admin role
  IF user_email LIKE '%@match-play.co' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.user_id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger on profiles table to auto-grant admin on user creation
DROP TRIGGER IF EXISTS auto_grant_admin_trigger ON public.profiles;
CREATE TRIGGER auto_grant_admin_trigger
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_grant_admin_to_match_play();

-- Validation function to prevent non-match-play.co users from becoming admins
CREATE OR REPLACE FUNCTION public.validate_admin_role_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_email TEXT;
BEGIN
  -- Only validate admin role assignments
  IF NEW.role = 'admin' THEN
    -- Get the user's email
    SELECT email INTO user_email
    FROM auth.users
    WHERE id = NEW.user_id;

    -- Prevent admin role for non-match-play.co users
    IF user_email IS NULL OR user_email NOT LIKE '%@match-play.co' THEN
      RAISE EXCEPTION 'Admin role can only be assigned to @match-play.co email users';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger to validate admin role assignments
DROP TRIGGER IF EXISTS validate_admin_assignment_trigger ON public.user_roles;
CREATE TRIGGER validate_admin_assignment_trigger
  BEFORE INSERT OR UPDATE ON public.user_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_admin_role_assignment();

-- Remove admin role from any existing non-match-play.co users
DELETE FROM public.user_roles
WHERE role = 'admin'
AND user_id IN (
  SELECT id FROM auth.users 
  WHERE email NOT LIKE '%@match-play.co'
);