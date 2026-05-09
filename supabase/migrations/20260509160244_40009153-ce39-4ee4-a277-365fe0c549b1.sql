
-- Track system bot users used to fill out 1-player "testing mode" matches.
CREATE TABLE IF NOT EXISTS public.bot_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  sort_order integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.bot_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view bot list"
ON public.bot_users
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can manage bot list"
ON public.bot_users
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Helper for SQL-side checks.
CREATE OR REPLACE FUNCTION public.is_bot_user(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.bot_users WHERE user_id = _user_id);
$$;

-- Prevent double-crediting winnings for the same match/user.
CREATE UNIQUE INDEX IF NOT EXISTS account_transactions_winnings_uidx
ON public.account_transactions (user_id, match_id, transaction_type)
WHERE match_id IS NOT NULL AND transaction_type = 'winning';
