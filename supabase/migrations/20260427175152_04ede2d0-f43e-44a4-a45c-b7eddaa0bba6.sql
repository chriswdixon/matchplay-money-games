
-- =====================================================================
-- 1) Realtime authorization: restrict realtime.messages subscriptions
-- =====================================================================
-- Enable RLS on realtime.messages (Supabase Realtime authorizes channels via this table)
ALTER TABLE IF EXISTS realtime.messages ENABLE ROW LEVEL SECURITY;

-- Drop any prior versions of our policies (idempotent)
DROP POLICY IF EXISTS "Authenticated users can subscribe to match channels they participate in" ON realtime.messages;
DROP POLICY IF EXISTS "Authenticated users can broadcast to match channels they participate in" ON realtime.messages;

-- Helper: extract a uuid from the topic when it looks like 'match:<uuid>' or 'match-<uuid>' etc.
-- We accept topics shaped like 'match:<uuid>' or 'match-<uuid>' or '<uuid>' directly.
CREATE OR REPLACE FUNCTION public.realtime_topic_match_id(topic text)
RETURNS uuid
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  candidate text;
BEGIN
  IF topic IS NULL THEN
    RETURN NULL;
  END IF;
  -- Strip common prefixes like 'match:', 'match-', 'match_'
  candidate := regexp_replace(topic, '^(match[:_-])', '', 'i');
  -- Validate uuid shape
  IF candidate ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RETURN candidate::uuid;
  END IF;
  RETURN NULL;
EXCEPTION WHEN others THEN
  RETURN NULL;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.realtime_topic_match_id(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.realtime_topic_match_id(text) TO authenticated, service_role;

-- SELECT policy: only participants/creators/admins for match-scoped topics
CREATE POLICY "Match participants can read realtime messages"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  CASE
    WHEN public.realtime_topic_match_id((SELECT realtime.topic())) IS NOT NULL THEN
      public.is_user_in_match(public.realtime_topic_match_id((SELECT realtime.topic())), auth.uid())
      OR public.is_user_match_creator(public.realtime_topic_match_id((SELECT realtime.topic())), auth.uid())
      OR public.has_role(auth.uid(), 'admin'::public.app_role)
    ELSE
      public.has_role(auth.uid(), 'admin'::public.app_role)
  END
);

-- INSERT policy (broadcasts/presence): same restriction
CREATE POLICY "Match participants can write realtime messages"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (
  CASE
    WHEN public.realtime_topic_match_id((SELECT realtime.topic())) IS NOT NULL THEN
      public.is_user_in_match(public.realtime_topic_match_id((SELECT realtime.topic())), auth.uid())
      OR public.is_user_match_creator(public.realtime_topic_match_id((SELECT realtime.topic())), auth.uid())
      OR public.has_role(auth.uid(), 'admin'::public.app_role)
    ELSE
      public.has_role(auth.uid(), 'admin'::public.app_role)
  END
);

-- =====================================================================
-- 2) match_results: allow match creators to view results
-- =====================================================================
DROP POLICY IF EXISTS "Match creators can view results" ON public.match_results;
CREATE POLICY "Match creators can view results"
ON public.match_results
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.matches m
    WHERE m.id = match_results.match_id
      AND m.created_by = (SELECT auth.uid())
  )
  OR public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
);

-- =====================================================================
-- 3) Lock down SECURITY DEFINER functions in public schema
--    Strategy: revoke from PUBLIC and anon; grant authenticated/service_role
--    only to functions that are intentionally callable by signed-in users.
-- =====================================================================

-- Revoke broadly from anon and PUBLIC on every SECURITY DEFINER function in public.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT n.nspname AS schema_name,
           p.proname AS func_name,
           pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef = true
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %I.%I(%s) FROM PUBLIC, anon;',
                   r.schema_name, r.func_name, r.args);
  END LOOP;
END $$;

-- Re-grant EXECUTE to authenticated + service_role for functions intentionally
-- callable by signed-in users (RPC endpoints) or required by RLS evaluation.
DO $$
DECLARE
  r record;
  callable_funcs text[] := ARRAY[
    'has_role',
    'is_user_in_match',
    'is_user_match_creator',
    'is_user_match_participant',
    'realtime_topic_match_id',
    'validate_invite',
    'link_invite_to_user',
    'get_user_private_data',
    'get_public_profile',
    'get_match_creator_info',
    'get_match_participant_count',
    'get_match_with_location_filter',
    'get_nearby_matches',
    'calculate_distance',
    'calculate_player_average_rating',
    'validate_and_join_match',
    'start_match',
    'leave_match_with_dnf',
    'record_double_down_vote',
    'create_match_join_token',
    'finalize_match_results'
  ];
BEGIN
  FOR r IN
    SELECT n.nspname AS schema_name,
           p.proname AS func_name,
           pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef = true
      AND p.proname = ANY(callable_funcs)
  LOOP
    EXECUTE format('GRANT EXECUTE ON FUNCTION %I.%I(%s) TO authenticated, service_role;',
                   r.schema_name, r.func_name, r.args);
  END LOOP;
END $$;
