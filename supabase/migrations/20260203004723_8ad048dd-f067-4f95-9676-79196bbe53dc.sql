-- Drop the overly permissive policy that allows all operations with USING (true)
-- Service role bypasses RLS by default, so this policy is unnecessary
DROP POLICY IF EXISTS "Service role can manage age verification tokens" ON public.age_verification_tokens;

-- The existing "Users can view their own age verification tokens" policy is correctly scoped
-- Users can only SELECT their own tokens (user_id = auth.uid())
-- INSERT/UPDATE/DELETE are now only possible via service role (edge functions)