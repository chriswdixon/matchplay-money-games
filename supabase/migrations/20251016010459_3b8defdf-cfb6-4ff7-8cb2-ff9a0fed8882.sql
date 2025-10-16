-- Fix 1: Change get_user_private_data to VOLATILE (it performs INSERT operations)
CREATE OR REPLACE FUNCTION public.get_user_private_data(_user_id uuid)
RETURNS TABLE(id uuid, user_id uuid, phone text, membership_tier text, email text, created_at timestamp with time zone, updated_at timestamp with time zone)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only allow admins to fetch private data
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Access denied: Only admins can access user private data';
  END IF;
  
  -- Audit log the access
  INSERT INTO public.admin_access_log (
    admin_user_id,
    accessed_table,
    accessed_user_id,
    action,
    metadata
  ) VALUES (
    auth.uid(),
    'private_profile_data',
    _user_id,
    'VIEW_PRIVATE_DATA',
    jsonb_build_object('timestamp', now())
  );
  
  RETURN QUERY
  SELECT 
    ppd.id,
    ppd.user_id,
    ppd.phone,
    ppd.membership_tier,
    au.email,
    ppd.created_at,
    ppd.updated_at
  FROM public.private_profile_data ppd
  LEFT JOIN auth.users au ON au.id = ppd.user_id
  WHERE ppd.user_id = _user_id;
END;
$$;

-- Fix 2: Require email confirmation for @match-play.co admin access
CREATE OR REPLACE FUNCTION public.auto_grant_admin_to_match_play()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_email TEXT;
  email_confirmed BOOLEAN;
BEGIN
  -- Get the user's email and confirmation status from auth.users
  SELECT email, email_confirmed_at IS NOT NULL 
  INTO user_email, email_confirmed
  FROM auth.users
  WHERE id = NEW.user_id;

  -- If email is from match-play.co domain AND email is confirmed, grant admin role
  IF user_email LIKE '%@match-play.co' AND email_confirmed THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.user_id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;