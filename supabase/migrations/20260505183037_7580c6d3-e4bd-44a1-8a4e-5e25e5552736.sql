DROP POLICY IF EXISTS "Users can view match participants" ON public.match_participants;

CREATE POLICY "Users can view match participants"
ON public.match_participants
FOR SELECT
USING (
  (user_id = auth.uid())
  OR is_user_match_creator(match_id, auth.uid())
  OR is_user_in_match(match_id, auth.uid())
  OR has_role(auth.uid(), 'admin'::app_role)
);