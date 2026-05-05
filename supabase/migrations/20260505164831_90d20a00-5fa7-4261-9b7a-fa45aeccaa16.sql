CREATE OR REPLACE FUNCTION public.debit_player_balance(_user_id uuid, _amount numeric)
RETURNS TABLE (id uuid, user_id uuid, balance numeric)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.player_accounts
  SET balance = balance - _amount,
      updated_at = now()
  WHERE user_id = _user_id AND balance >= _amount
  RETURNING id, user_id, balance;
$$;

CREATE OR REPLACE FUNCTION public.credit_player_balance(_user_id uuid, _amount numeric)
RETURNS TABLE (id uuid, user_id uuid, balance numeric)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.player_accounts
  SET balance = balance + _amount,
      updated_at = now()
  WHERE user_id = _user_id
  RETURNING id, user_id, balance;
$$;

REVOKE EXECUTE ON FUNCTION public.debit_player_balance(uuid, numeric) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.credit_player_balance(uuid, numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.debit_player_balance(uuid, numeric) TO service_role;
GRANT EXECUTE ON FUNCTION public.credit_player_balance(uuid, numeric) TO service_role;