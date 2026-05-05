
-- Allow admins to perform the writes needed by the admin "Delete Match" workflow.
-- Previously these inserts/updates were restricted to service_role only, causing
-- the client-side admin deletion to fail.

CREATE POLICY "Admins can update player accounts"
ON public.player_accounts
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert account transactions"
ON public.account_transactions
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert admin access log"
ON public.admin_access_log
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND admin_user_id = auth.uid());
