
-- 1. Protect team PINs: replace SELECT policy on matches and add a column-masking via secure view-like function approach.
-- Simplest: revoke direct SELECT on PIN columns from authenticated and require going through a function for participants.
-- We'll use column-level GRANTs.

REVOKE SELECT (pin, team2_pin, team3_pin, team4_pin) ON public.matches FROM authenticated, anon, PUBLIC;

-- Provide a SECURITY DEFINER function for creators/admins to retrieve team PINs they created
CREATE OR REPLACE FUNCTION public.get_match_team_pins(p_match_id uuid)
RETURNS TABLE(team_number integer, pin text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_is_admin boolean;
  v_creator uuid;
BEGIN
  IF v_uid IS NULL THEN RETURN; END IF;
  SELECT created_by INTO v_creator FROM public.matches WHERE id = p_match_id;
  v_is_admin := public.has_role(v_uid, 'admin'::app_role);

  RETURN QUERY
  SELECT t.team_number, t.pin FROM (
    SELECT 1 AS team_number, m.pin AS pin, m.team1_pin_creator AS creator FROM public.matches m WHERE m.id = p_match_id
    UNION ALL SELECT 2, m.team2_pin, m.team2_pin_creator FROM public.matches m WHERE m.id = p_match_id
    UNION ALL SELECT 3, m.team3_pin, m.team3_pin_creator FROM public.matches m WHERE m.id = p_match_id
    UNION ALL SELECT 4, m.team4_pin, m.team4_pin_creator FROM public.matches m WHERE m.id = p_match_id
  ) t
  WHERE t.pin IS NOT NULL
    AND (v_is_admin OR v_creator = v_uid OR t.creator = v_uid);
END;
$$;

REVOKE ALL ON FUNCTION public.get_match_team_pins(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_match_team_pins(uuid) TO authenticated, service_role;

-- 2. Lock match_results after finalization
DROP POLICY IF EXISTS "Match participants can update results" ON public.match_results;
CREATE POLICY "Participants can update non-finalized results"
ON public.match_results
FOR UPDATE
TO authenticated
USING (
  finalized_at IS NULL
  AND EXISTS (SELECT 1 FROM public.match_participants mp
              WHERE mp.match_id = match_results.match_id AND mp.user_id = auth.uid())
)
WITH CHECK (
  finalized_at IS NULL
  AND EXISTS (SELECT 1 FROM public.match_participants mp
              WHERE mp.match_id = match_results.match_id AND mp.user_id = auth.uid())
);

CREATE POLICY "Admins can update finalized results"
ON public.match_results
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Also block INSERT after finalization exists for the same match
DROP POLICY IF EXISTS "Match participants can insert results" ON public.match_results;
CREATE POLICY "Match participants can insert results"
ON public.match_results
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (SELECT 1 FROM public.match_participants mp
          WHERE mp.match_id = match_results.match_id AND mp.user_id = auth.uid())
  AND NOT EXISTS (SELECT 1 FROM public.match_results mr
                  WHERE mr.match_id = match_results.match_id AND mr.finalized_at IS NOT NULL)
);

-- 3. Restore EXECUTE for invite validation used during signup
GRANT EXECUTE ON FUNCTION public.validate_and_consume_invite(text, text) TO authenticated, service_role;
