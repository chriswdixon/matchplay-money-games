-- Fix the trigger function to be VOLATILE instead of default
CREATE OR REPLACE FUNCTION public.auto_grant_admin_to_match_play()
RETURNS TRIGGER
LANGUAGE plpgsql
VOLATILE
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