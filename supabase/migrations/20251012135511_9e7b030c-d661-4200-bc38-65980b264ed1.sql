-- Create transaction type enum
CREATE TYPE transaction_type AS ENUM (
  'winning',
  'match_buyin',
  'match_cancellation',
  'subscription_charge',
  'coupon',
  'payout'
);

-- Create player_accounts table
CREATE TABLE public.player_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  balance NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (balance >= 0),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create account_transactions table
CREATE TABLE public.account_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES public.player_accounts(id) ON DELETE CASCADE,
  amount NUMERIC(10, 2) NOT NULL,
  transaction_type transaction_type NOT NULL,
  match_id UUID REFERENCES public.matches(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  stripe_payment_intent_id TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.player_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for player_accounts
CREATE POLICY "Users can view their own account"
  ON public.player_accounts FOR SELECT
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can insert their own account"
  ON public.player_accounts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role can update accounts"
  ON public.player_accounts FOR UPDATE
  USING (true);

-- RLS Policies for account_transactions
CREATE POLICY "Users can view their own transactions"
  ON public.account_transactions FOR SELECT
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role can insert transactions"
  ON public.account_transactions FOR INSERT
  WITH CHECK (true);

-- Create indexes
CREATE INDEX idx_player_accounts_user_id ON public.player_accounts(user_id);
CREATE INDEX idx_account_transactions_user_id ON public.account_transactions(user_id);
CREATE INDEX idx_account_transactions_account_id ON public.account_transactions(account_id);
CREATE INDEX idx_account_transactions_match_id ON public.account_transactions(match_id);
CREATE INDEX idx_account_transactions_created_at ON public.account_transactions(created_at DESC);

-- Trigger to auto-create player account on user signup
CREATE OR REPLACE FUNCTION public.create_player_account()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.player_accounts (user_id, balance)
  VALUES (NEW.id, 0)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created_account
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.create_player_account();

-- Trigger to update player_accounts.updated_at
CREATE TRIGGER update_player_accounts_updated_at
  BEFORE UPDATE ON public.player_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Function to get user account info (for admin)
CREATE OR REPLACE FUNCTION public.get_user_account_info(target_user_id UUID)
RETURNS TABLE(
  account_id UUID,
  balance NUMERIC,
  total_winnings NUMERIC,
  total_buyins NUMERIC,
  total_payouts NUMERIC,
  transaction_count INTEGER
)
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