-- 1. Match results: drop overly permissive participant update policy
DROP POLICY IF EXISTS "Participants can update non-finalized results" ON public.match_results;

CREATE POLICY "Match creators can update non-finalized results"
ON public.match_results
FOR UPDATE
USING (
  finalized_at IS NULL
  AND EXISTS (
    SELECT 1 FROM public.matches m
    WHERE m.id = match_results.match_id AND m.created_by = auth.uid()
  )
)
WITH CHECK (
  finalized_at IS NULL
  AND EXISTS (
    SELECT 1 FROM public.matches m
    WHERE m.id = match_results.match_id AND m.created_by = auth.uid()
  )
);

-- 2. Profile pictures storage: explicit owner-scoped SELECT policy
CREATE POLICY "Users can view their own profile pictures"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'profile-pictures'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 3. Revoke anon SELECT on user-private tables (RLS still applies for authenticated)
REVOKE SELECT ON public.match_join_requests FROM anon;
REVOKE SELECT ON public.notifications FROM anon;
REVOKE SELECT ON public.support_requests FROM anon;

-- 4. Revoke anon EXECUTE on internal trigger helper SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.notify_match_creator_on_join() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_match_creator_on_join_request() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_on_cancellation_review() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_participants_on_finalize() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_support_request() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.tg_audit_match_created() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.tg_audit_match_score() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.tg_audit_match_status() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.tg_audit_participant_join() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.tg_audit_participant_leave() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.tg_audit_pin_attempt() FROM anon, PUBLIC;