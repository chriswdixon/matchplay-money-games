-- Add RLS policies to protect match_results table from unauthorized manipulation

-- Policy 1: Only match participants can insert results
-- This works in conjunction with the finalize_match_results function
CREATE POLICY "Match participants can insert results"
ON public.match_results
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.match_participants mp
    WHERE mp.match_id = match_results.match_id
    AND mp.user_id = auth.uid()
  )
);

-- Policy 2: Only match participants can update results
-- This prevents unauthorized modification of existing results
CREATE POLICY "Match participants can update results"
ON public.match_results
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.match_participants mp
    WHERE mp.match_id = match_results.match_id
    AND mp.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.match_participants mp
    WHERE mp.match_id = match_results.match_id
    AND mp.user_id = auth.uid()
  )
);

-- Policy 3: Only match creators can delete results
-- This provides a way to remove results if needed, but only by the match creator
CREATE POLICY "Match creators can delete results"
ON public.match_results
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.matches m
    WHERE m.id = match_results.match_id
    AND m.created_by = auth.uid()
  )
);