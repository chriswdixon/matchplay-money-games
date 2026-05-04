-- Lock down match/realtime helper functions: only authenticated users + service_role may execute.
-- They remain usable inside RLS policies (which run as the caller's role).

REVOKE EXECUTE ON FUNCTION public.realtime_topic_match_id(text)        FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_user_in_match(uuid, uuid)         FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_user_match_participant(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_match_participant(uuid, uuid)     FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_user_match_creator(uuid, uuid)    FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role)      FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.realtime_topic_match_id(text)         TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_user_in_match(uuid, uuid)          TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_user_match_participant(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_match_participant(uuid, uuid)      TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_user_match_creator(uuid, uuid)     TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role)       TO authenticated, service_role;