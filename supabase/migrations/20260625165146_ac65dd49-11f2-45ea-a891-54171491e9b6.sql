-- 1) Block clients from forging a "finalized" match_results row.
--    The trusted finalize_match_results RPC is SECURITY DEFINER and bypasses RLS,
--    so it can still write finalized rows; ordinary participants cannot.
DROP POLICY IF EXISTS "Match participants can insert results" ON public.match_results;
CREATE POLICY "Match participants can insert results"
ON public.match_results
FOR INSERT
WITH CHECK (
  finalized_at IS NULL
  AND finalized_by IS NULL
  AND EXISTS (
    SELECT 1 FROM public.match_participants mp
    WHERE mp.match_id = match_results.match_id
      AND mp.user_id = auth.uid()
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.match_results mr
    WHERE mr.match_id = match_results.match_id
      AND mr.finalized_at IS NOT NULL
  )
);

-- 2) Only allow a match to transition to 'completed' when a trusted finalized
--    result exists (created exclusively by the SECURITY DEFINER finalize RPC),
--    or when performed by the service_role or an admin.
CREATE OR REPLACE FUNCTION public.prevent_unauthorized_match_completion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'completed' AND COALESCE(OLD.status, '') <> 'completed' THEN
    IF auth.role() = 'service_role'
       OR public.has_role(auth.uid(), 'admin')
       OR EXISTS (
            SELECT 1 FROM public.match_results mr
            WHERE mr.match_id = NEW.id
              AND mr.finalized_at IS NOT NULL
          ) THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Match completion is only permitted through the finalize flow';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_unauthorized_match_completion ON public.matches;
CREATE TRIGGER trg_prevent_unauthorized_match_completion
BEFORE UPDATE ON public.matches
FOR EACH ROW
EXECUTE FUNCTION public.prevent_unauthorized_match_completion();
