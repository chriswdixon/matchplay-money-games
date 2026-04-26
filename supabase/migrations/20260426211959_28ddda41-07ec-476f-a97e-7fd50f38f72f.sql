-- 1) Tighten match_participants INSERT: only allow self-joining.
--    The secure server-side join function runs as SECURITY DEFINER and
--    bypasses RLS, so creator-driven flows continue to work via that path.
DROP POLICY IF EXISTS "Users can join matches via secure function" ON public.match_participants;

CREATE POLICY "Users can self-join matches"
  ON public.match_participants
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

-- 2) Hide raw match PIN columns from clients.
--    PINs are validated server-side via SECURITY DEFINER functions; the
--    column values themselves should never be returned to the API.
REVOKE SELECT (pin, team2_pin, team3_pin, team4_pin)
  ON public.matches FROM anon, authenticated;

-- 3) Allow the cancelling player to view their own review record.
CREATE POLICY "Cancelling player can view their own review"
  ON public.match_cancellation_reviews
  FOR SELECT
  TO authenticated
  USING (cancelling_player_id = (SELECT auth.uid()));