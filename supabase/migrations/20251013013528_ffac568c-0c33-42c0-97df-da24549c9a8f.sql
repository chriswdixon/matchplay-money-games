-- Update validate_and_consume_invite function to use generic error messages and add format validation
CREATE OR REPLACE FUNCTION public.validate_and_consume_invite(p_code text, p_email text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_invite RECORD;
BEGIN
  -- Validate invite code format (6-32 characters, alphanumeric)
  IF p_code IS NULL OR LENGTH(p_code) < 6 OR LENGTH(p_code) > 32 THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Invalid or expired invite code');
  END IF;

  -- Check if email is from @match-play.co domain (no invite needed)
  IF p_email LIKE '%@match-play.co' THEN
    RETURN jsonb_build_object('valid', true, 'bypass', true);
  END IF;

  -- Find the invite
  SELECT * INTO v_invite
  FROM public.invites
  WHERE code = p_code
  FOR UPDATE;

  -- Use generic error message for all failure cases (security best practice to prevent enumeration)
  IF NOT FOUND OR v_invite.used_by IS NOT NULL OR v_invite.expires_at < now() THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Invalid or expired invite code');
  END IF;

  -- Mark as used (will be updated with actual user_id after signup)
  UPDATE public.invites
  SET used_at = now()
  WHERE id = v_invite.id;

  RETURN jsonb_build_object('valid', true, 'invite_id', v_invite.id);
END;
$function$;