-- Harden security for profile_audit_log table
-- This prevents users from directly inserting audit records
-- Only system triggers and SECURITY DEFINER functions can insert

-- Drop any existing INSERT policies on profile_audit_log
DROP POLICY IF EXISTS "System only audit inserts" ON public.profile_audit_log;

-- Create restrictive INSERT policy that blocks direct user inserts
-- System operations (triggers, SECURITY DEFINER functions) bypass this
CREATE POLICY "Deny direct audit log inserts"
ON public.profile_audit_log
FOR INSERT
TO authenticated
WITH CHECK (false);

-- Add a permissive policy for service role only
CREATE POLICY "Service role can insert audit logs"
ON public.profile_audit_log
FOR INSERT
TO service_role
WITH CHECK (true);