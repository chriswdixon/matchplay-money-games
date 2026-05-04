
-- 1) is_user_in_match
CREATE OR REPLACE FUNCTION public.is_user_in_match(p_match_id uuid, p_user_id uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL OR p_match_id IS NULL OR p_user_id IS NULL THEN RETURN false; END IF;
  RETURN EXISTS (SELECT 1 FROM public.match_participants WHERE match_id = p_match_id AND user_id = p_user_id);
END;$$;

-- 2) is_user_match_participant
CREATE OR REPLACE FUNCTION public.is_user_match_participant(p_match_id uuid, p_user_id uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL OR p_match_id IS NULL OR p_user_id IS NULL THEN RETURN false; END IF;
  RETURN EXISTS (SELECT 1 FROM public.match_participants WHERE match_id = p_match_id AND user_id = p_user_id);
END;$$;

-- 3) is_match_participant (legacy, keeps original param names match_id/user_id)
CREATE OR REPLACE FUNCTION public.is_match_participant(match_id uuid, user_id uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL OR match_id IS NULL OR user_id IS NULL THEN RETURN false; END IF;
  RETURN EXISTS (SELECT 1 FROM public.match_participants mp WHERE mp.match_id = is_match_participant.match_id AND mp.user_id = is_match_participant.user_id);
END;$$;

-- 4) is_user_match_creator
CREATE OR REPLACE FUNCTION public.is_user_match_creator(p_match_id uuid, p_user_id uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL OR p_match_id IS NULL OR p_user_id IS NULL THEN RETURN false; END IF;
  RETURN EXISTS (SELECT 1 FROM public.matches WHERE id = p_match_id AND created_by = p_user_id);
END;$$;

-- 5) has_role: reject NULLs
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF _user_id IS NULL OR _role IS NULL THEN RETURN false; END IF;
  RETURN EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
END;$$;

-- 6) realtime_topic_match_id: clamp length to limit regex abuse
CREATE OR REPLACE FUNCTION public.realtime_topic_match_id(topic text)
RETURNS uuid LANGUAGE plpgsql IMMUTABLE SET search_path TO 'public'
AS $$
DECLARE m text;
BEGIN
  IF topic IS NULL OR length(topic) > 512 THEN RETURN NULL; END IF;
  m := (regexp_match(topic, '([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})', 'i'))[1];
  IF m IS NOT NULL THEN RETURN m::uuid; END IF;
  RETURN NULL;
EXCEPTION WHEN others THEN RETURN NULL;
END;$$;

-- Re-assert grants
REVOKE EXECUTE ON FUNCTION public.is_user_in_match(uuid, uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.is_user_in_match(uuid, uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.is_user_match_participant(uuid, uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.is_user_match_participant(uuid, uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.is_match_participant(uuid, uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.is_match_participant(uuid, uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.is_user_match_creator(uuid, uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.is_user_match_creator(uuid, uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.realtime_topic_match_id(text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.realtime_topic_match_id(text) TO authenticated, service_role;
