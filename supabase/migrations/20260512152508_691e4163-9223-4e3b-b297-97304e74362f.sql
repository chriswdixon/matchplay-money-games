CREATE OR REPLACE FUNCTION public.is_user_in_match(p_match_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL OR p_match_id IS NULL OR p_user_id IS NULL THEN RETURN false; END IF;
  RETURN EXISTS (
    SELECT 1 FROM public.match_participants
    WHERE match_id = p_match_id
      AND user_id = p_user_id
      AND status = 'active'
  );
END;$function$;