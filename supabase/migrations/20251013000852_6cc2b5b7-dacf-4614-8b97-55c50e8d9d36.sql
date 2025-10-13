-- Fix Security Finding: Remove redundant admin SELECT policy on private_profile_data
-- The "Users can view only their own private data" policy already includes admin access
DROP POLICY IF EXISTS "Only admins can view all private data" ON public.private_profile_data;

-- Fix Security Finding: Add audit logging for admin access to sensitive data
-- Create audit log table for admin data access
CREATE TABLE IF NOT EXISTS public.admin_access_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid NOT NULL,
  accessed_table text NOT NULL,
  accessed_user_id uuid,
  action text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on admin access log
ALTER TABLE public.admin_access_log ENABLE ROW LEVEL SECURITY;

-- Only admins can view admin access logs
CREATE POLICY "Admins can view access logs"
ON public.admin_access_log
FOR SELECT
USING (has_role(auth.uid(), 'admin'));

-- Service role can insert access logs (for edge functions)
CREATE POLICY "Service role can insert access logs"
ON public.admin_access_log
FOR INSERT
WITH CHECK (true);

-- Update get_user_private_data function to include audit logging
CREATE OR REPLACE FUNCTION public.get_user_private_data(_user_id uuid)
RETURNS TABLE(id uuid, user_id uuid, phone text, membership_tier text, email text, created_at timestamp with time zone, updated_at timestamp with time zone)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only allow admins to fetch private data
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Access denied: Only admins can access user private data';
  END IF;
  
  -- Audit log the access
  INSERT INTO public.admin_access_log (
    admin_user_id,
    accessed_table,
    accessed_user_id,
    action,
    metadata
  ) VALUES (
    auth.uid(),
    'private_profile_data',
    _user_id,
    'VIEW_PRIVATE_DATA',
    jsonb_build_object('timestamp', now())
  );
  
  RETURN QUERY
  SELECT 
    ppd.id,
    ppd.user_id,
    ppd.phone,
    ppd.membership_tier,
    au.email,
    ppd.created_at,
    ppd.updated_at
  FROM public.private_profile_data ppd
  LEFT JOIN auth.users au ON au.id = ppd.user_id
  WHERE ppd.user_id = _user_id;
END;
$$;

-- Update get_user_account_info function to include audit logging
CREATE OR REPLACE FUNCTION public.get_user_account_info(target_user_id uuid)
RETURNS TABLE(account_id uuid, balance numeric, total_winnings numeric, total_buyins numeric, total_payouts numeric, transaction_count integer)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only admins can access this
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Access denied: Only admins can view account info';
  END IF;

  -- Audit log the access
  INSERT INTO public.admin_access_log (
    admin_user_id,
    accessed_table,
    accessed_user_id,
    action,
    metadata
  ) VALUES (
    auth.uid(),
    'player_accounts',
    target_user_id,
    'VIEW_ACCOUNT_BALANCE',
    jsonb_build_object('timestamp', now())
  );

  RETURN QUERY
  SELECT 
    pa.id as account_id,
    pa.balance,
    COALESCE(SUM(CASE WHEN at.transaction_type = 'winning' THEN at.amount ELSE 0 END), 0) as total_winnings,
    COALESCE(ABS(SUM(CASE WHEN at.transaction_type = 'match_buyin' THEN at.amount ELSE 0 END)), 0) as total_buyins,
    COALESCE(ABS(SUM(CASE WHEN at.transaction_type = 'payout' THEN at.amount ELSE 0 END)), 0) as total_payouts,
    COUNT(at.id)::INTEGER as transaction_count
  FROM public.player_accounts pa
  LEFT JOIN public.account_transactions at ON at.account_id = pa.id
  WHERE pa.user_id = target_user_id
  GROUP BY pa.id, pa.balance;
END;
$$;

-- Add comment explaining the security design
COMMENT ON POLICY "Users can view only their own private data" ON public.private_profile_data IS 
'Allows users to view their own private data, and admins to view all private data. Admin access is validated server-side via has_role() security definer function and logged to admin_access_log table.';