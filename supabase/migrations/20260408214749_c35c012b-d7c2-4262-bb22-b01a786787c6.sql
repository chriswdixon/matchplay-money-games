
-- 1. Fix account_transactions: restrict INSERT to service_role only
DROP POLICY IF EXISTS "Service role can insert transactions" ON public.account_transactions;
CREATE POLICY "Service role can insert transactions"
ON public.account_transactions
FOR INSERT
TO service_role
WITH CHECK (true);

-- 2. Fix player_accounts: restrict UPDATE to service_role only
DROP POLICY IF EXISTS "Service role can update accounts" ON public.player_accounts;
CREATE POLICY "Service role can update accounts"
ON public.player_accounts
FOR UPDATE
TO service_role
USING (true);

-- 3. Fix match_participants: remove session variable bypass from INSERT policy
DROP POLICY IF EXISTS "Users can join matches via secure function" ON public.match_participants;
CREATE POLICY "Users can join matches via secure function"
ON public.match_participants
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM matches m
    WHERE m.id = match_participants.match_id
    AND m.created_by = (SELECT auth.uid())
  )
);
