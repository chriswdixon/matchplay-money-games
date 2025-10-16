-- Fix get_user_private_data function to be VOLATILE instead of STABLE
-- This function performs INSERT operations (audit logging) so it cannot be STABLE
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