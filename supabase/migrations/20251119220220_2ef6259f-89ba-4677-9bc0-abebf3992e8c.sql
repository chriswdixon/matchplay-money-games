-- Allow admins to view all matches
DROP POLICY IF EXISTS "Users can view matches" ON public.matches;

CREATE POLICY "Users can view matches"
ON public.matches
FOR SELECT
TO authenticated
USING (
  (status = 'open'::text) 
  OR (created_by = auth.uid()) 
  OR is_user_match_participant(id, auth.uid())
  OR has_role(auth.uid(), 'admin'::app_role)
);