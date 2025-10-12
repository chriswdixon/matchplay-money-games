-- Add CHECK constraints on account_transactions amount
-- Defense-in-depth: prevent unrealistic transaction amounts
ALTER TABLE public.account_transactions 
ADD CONSTRAINT amount_reasonable_range 
CHECK (
  amount >= -10000 AND amount <= 10000
);

-- Add comment explaining the constraint
COMMENT ON CONSTRAINT amount_reasonable_range ON public.account_transactions 
IS 'Prevents unrealistic transaction amounts. Buy-ins and payouts must be between -$10,000 and $10,000';

-- Tighten profile_audit_log RLS policy
-- Remove overly permissive service role policy
DROP POLICY IF EXISTS "Service role can insert audit logs" ON public.profile_audit_log;

-- Audit logs should ONLY be inserted via triggers/functions with SECURITY DEFINER
-- This policy ensures no direct inserts are possible, even from service role
-- The existing "Deny direct audit log inserts" policy already blocks normal users
-- Triggers and functions with SECURITY DEFINER bypass RLS and can still insert