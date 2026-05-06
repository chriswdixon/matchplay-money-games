
-- 1. Restrict match_participants INSERT: must be open match (creator self-join still works since match starts as 'open')
DROP POLICY IF EXISTS "Users can self-join matches" ON public.match_participants;
CREATE POLICY "Users can self-join matches"
ON public.match_participants
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = (SELECT auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.matches m
    WHERE m.id = match_id
      AND m.status = 'open'
      AND (
        SELECT COUNT(*) FROM public.match_participants mp
        WHERE mp.match_id = m.id AND mp.status = 'active'
      ) < m.max_participants
  )
);

-- 2. Restrict double_down_participants UPDATE: forbid users from setting payment_processed / payment_intent_id directly
DROP POLICY IF EXISTS "Users can update their own double down participation" ON public.double_down_participants;
CREATE POLICY "Users can update their own double down participation"
ON public.double_down_participants
FOR UPDATE
TO authenticated
USING (user_id = (SELECT auth.uid()))
WITH CHECK (
  user_id = (SELECT auth.uid())
  AND payment_processed = (SELECT d.payment_processed FROM public.double_down_participants d WHERE d.id = double_down_participants.id)
  AND (payment_intent_id IS NOT DISTINCT FROM (SELECT d.payment_intent_id FROM public.double_down_participants d WHERE d.id = double_down_participants.id))
);

-- 3. Revoke direct column-level SELECT on PIN columns from authenticated.
-- Force callers to use the SECURITY DEFINER get_match_team_pins() RPC, which returns only PINs the user is entitled to see.
REVOKE SELECT (pin, team2_pin, team3_pin, team4_pin) ON public.matches FROM authenticated;
REVOKE SELECT (pin, team2_pin, team3_pin, team4_pin) ON public.matches FROM anon;

-- Ensure validate_and_join_match (SECURITY DEFINER) and other definer functions can still read these columns
GRANT SELECT ON public.matches TO postgres;
