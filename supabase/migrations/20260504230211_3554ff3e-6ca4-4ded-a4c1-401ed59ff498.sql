DROP POLICY IF EXISTS "Match participants can read realtime messages" ON realtime.messages;
DROP POLICY IF EXISTS "Match participants can write realtime messages" ON realtime.messages;

CREATE POLICY "Match participants can read realtime messages"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  CASE
    WHEN public.realtime_topic_match_id((SELECT realtime.topic())) IS NOT NULL THEN (
      public.is_user_in_match(public.realtime_topic_match_id((SELECT realtime.topic())), auth.uid())
      OR public.is_user_match_creator(public.realtime_topic_match_id((SELECT realtime.topic())), auth.uid())
      OR public.has_role(auth.uid(), 'admin'::public.app_role)
    )
    ELSE false
  END
);

CREATE POLICY "Match participants can write realtime messages"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (
  CASE
    WHEN public.realtime_topic_match_id((SELECT realtime.topic())) IS NOT NULL THEN (
      public.is_user_in_match(public.realtime_topic_match_id((SELECT realtime.topic())), auth.uid())
      OR public.is_user_match_creator(public.realtime_topic_match_id((SELECT realtime.topic())), auth.uid())
      OR public.has_role(auth.uid(), 'admin'::public.app_role)
    )
    ELSE false
  END
);