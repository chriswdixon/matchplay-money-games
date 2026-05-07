DROP POLICY IF EXISTS "Players can update their own scores" ON public.match_scores;
CREATE POLICY "Players can update their own scores"
ON public.match_scores
FOR UPDATE
TO authenticated
USING (
  player_id = (SELECT auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.match_participants mp
    WHERE mp.match_id = match_scores.match_id
      AND mp.user_id = (SELECT auth.uid())
  )
)
WITH CHECK (
  player_id = (SELECT auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.match_participants mp
    WHERE mp.match_id = match_scores.match_id
      AND mp.user_id = (SELECT auth.uid())
  )
);