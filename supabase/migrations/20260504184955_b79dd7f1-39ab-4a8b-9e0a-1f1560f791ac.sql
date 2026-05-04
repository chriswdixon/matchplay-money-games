
-- 1. account_deletion_requests: restrict to authenticated
DROP POLICY IF EXISTS "Users can create their own deletion requests" ON public.account_deletion_requests;
DROP POLICY IF EXISTS "Users can update their own pending deletion requests" ON public.account_deletion_requests;
DROP POLICY IF EXISTS "Users can view their own deletion requests" ON public.account_deletion_requests;
DROP POLICY IF EXISTS "Admins can view all deletion requests" ON public.account_deletion_requests;
DROP POLICY IF EXISTS "Admins can update deletion requests" ON public.account_deletion_requests;

CREATE POLICY "Users can create their own deletion requests"
ON public.account_deletion_requests FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own pending deletion requests"
ON public.account_deletion_requests FOR UPDATE TO authenticated
USING (user_id = auth.uid() AND status = 'pending')
WITH CHECK (user_id = auth.uid() AND status = 'cancelled');

CREATE POLICY "Users can view their own deletion requests"
ON public.account_deletion_requests FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Admins can view all deletion requests"
ON public.account_deletion_requests FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update deletion requests"
ON public.account_deletion_requests FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 2. match_join_tokens: restrict insert/update to service_role
DROP POLICY IF EXISTS "Service role can insert tokens" ON public.match_join_tokens;
DROP POLICY IF EXISTS "Service role can update tokens" ON public.match_join_tokens;

CREATE POLICY "Service role can insert tokens"
ON public.match_join_tokens FOR INSERT TO service_role
WITH CHECK (true);

CREATE POLICY "Service role can update tokens"
ON public.match_join_tokens FOR UPDATE TO service_role
USING (true) WITH CHECK (true);

-- 3. matches table realtime: drop and re-add with column list excluding PIN columns
ALTER PUBLICATION supabase_realtime DROP TABLE public.matches;
ALTER PUBLICATION supabase_realtime ADD TABLE public.matches
  (id, created_by, course_name, location, scheduled_time, format, buy_in_amount,
   handicap_min, handicap_max, max_participants, status, created_at, updated_at,
   latitude, longitude, address, hole_pars, booking_url, tee_selection_mode,
   default_tees, holes, is_team_format,
   team1_pin_creator, team2_pin_creator, team3_pin_creator, team4_pin_creator,
   double_down_enabled, double_down_amount, double_down_finalized, tee_data);

-- 4. Extend realtime_topic_match_id to find UUID anywhere in topic
CREATE OR REPLACE FUNCTION public.realtime_topic_match_id(topic text)
RETURNS uuid
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $function$
DECLARE
  m text;
BEGIN
  IF topic IS NULL THEN
    RETURN NULL;
  END IF;
  m := (regexp_match(topic, '([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})', 'i'))[1];
  IF m IS NOT NULL THEN
    RETURN m::uuid;
  END IF;
  RETURN NULL;
EXCEPTION WHEN others THEN
  RETURN NULL;
END;
$function$;

-- 5. Update realtime.messages policies: allow authenticated users on non-match topics
DROP POLICY IF EXISTS "Match participants can read realtime messages" ON realtime.messages;
DROP POLICY IF EXISTS "Match participants can write realtime messages" ON realtime.messages;

CREATE POLICY "Match participants can read realtime messages"
ON realtime.messages FOR SELECT TO authenticated
USING (
  CASE
    WHEN realtime_topic_match_id((SELECT realtime.topic())) IS NOT NULL THEN
      is_user_in_match(realtime_topic_match_id((SELECT realtime.topic())), auth.uid())
      OR is_user_match_creator(realtime_topic_match_id((SELECT realtime.topic())), auth.uid())
      OR has_role(auth.uid(), 'admin'::app_role)
    ELSE auth.uid() IS NOT NULL
  END
);

CREATE POLICY "Match participants can write realtime messages"
ON realtime.messages FOR INSERT TO authenticated
WITH CHECK (
  CASE
    WHEN realtime_topic_match_id((SELECT realtime.topic())) IS NOT NULL THEN
      is_user_in_match(realtime_topic_match_id((SELECT realtime.topic())), auth.uid())
      OR is_user_match_creator(realtime_topic_match_id((SELECT realtime.topic())), auth.uid())
      OR has_role(auth.uid(), 'admin'::app_role)
    ELSE auth.uid() IS NOT NULL
  END
);
