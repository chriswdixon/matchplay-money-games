CREATE OR REPLACE FUNCTION public.log_score_attempt(
  p_match_id uuid,
  p_hole_number integer,
  p_strokes integer,
  p_outcome text,
  p_reason text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  IF p_outcome NOT IN ('success', 'blocked_not_participant', 'rls_denied', 'error', 'offline_only') THEN
    RAISE EXCEPTION 'invalid outcome';
  END IF;

  INSERT INTO public.audit_log (
    category, event_type, summary, match_id, user_id, actor_id, payload
  ) VALUES (
    'score'::audit_category,
    'score_save_attempt',
    'Score save attempt (' || p_outcome || ') hole ' || p_hole_number,
    p_match_id,
    v_uid,
    v_uid,
    jsonb_build_object(
      'hole_number', p_hole_number,
      'strokes', p_strokes,
      'outcome', p_outcome,
      'reason', p_reason,
      'logged_at', now()
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.log_score_attempt(uuid, integer, integer, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.log_score_attempt(uuid, integer, integer, text, text) TO authenticated;