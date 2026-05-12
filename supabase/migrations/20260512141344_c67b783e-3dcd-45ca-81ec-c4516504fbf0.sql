
-- Fix 1: pin_attempts — remove authenticated INSERT policy.
-- SECURITY DEFINER functions (e.g. join_match_with_pin) write attempts and bypass RLS,
-- so direct authenticated inserts are not needed and were a brute-force/poisoning vector.
DROP POLICY IF EXISTS "Service role can insert attempts" ON public.pin_attempts;

-- Fix 2: match_chat_messages — UPDATE must require active match membership,
-- consistent with the INSERT policy. Previously a user who left a match could still
-- edit messages they had sent.
DROP POLICY IF EXISTS "Senders can edit own messages" ON public.match_chat_messages;
CREATE POLICY "Senders can edit own messages"
ON public.match_chat_messages
FOR UPDATE
TO authenticated
USING (sender_id = auth.uid() AND public.is_user_in_match(match_id, auth.uid()))
WITH CHECK (sender_id = auth.uid() AND public.is_user_in_match(match_id, auth.uid()));
