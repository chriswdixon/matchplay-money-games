-- Fix get_user_account_info function: change from STABLE to VOLATILE
-- because it performs INSERT operations for audit logging

CREATE OR REPLACE FUNCTION public.get_user_account_info(target_user_id uuid)
 RETURNS TABLE(account_id uuid, balance numeric, total_winnings numeric, total_buyins numeric, total_payouts numeric, transaction_count integer)
 LANGUAGE plpgsql
 VOLATILE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;