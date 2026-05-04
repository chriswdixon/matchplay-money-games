
-- =========================================================
-- 1. Tighten permissive "Service role" INSERT policies
--    (drop the role=public versions, recreate restricted to service_role)
-- =========================================================

DROP POLICY IF EXISTS "Service role can insert access logs" ON public.admin_access_log;
CREATE POLICY "Service role can insert access logs"
ON public.admin_access_log
FOR INSERT
TO service_role
WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can insert reviews" ON public.incomplete_match_reviews;
CREATE POLICY "Service role can insert reviews"
ON public.incomplete_match_reviews
FOR INSERT
TO service_role
WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can insert reviews" ON public.match_cancellation_reviews;
CREATE POLICY "Service role can insert reviews"
ON public.match_cancellation_reviews
FOR INSERT
TO service_role
WITH CHECK (true);

-- =========================================================
-- 2. Storage: stop allowing authenticated users to list profile-pictures bucket.
--    (Files remain accessible via public URL because bucket.public = true)
-- =========================================================

DROP POLICY IF EXISTS "Authenticated users can view profile pictures" ON storage.objects;

-- =========================================================
-- 3. Revoke EXECUTE on trigger-only SECURITY DEFINER functions.
--    These are only invoked by triggers and never called from the API.
--    Functions used inside RLS policies (has_role, is_user_in_match, etc.) are intentionally left alone.
-- =========================================================

DO $$
DECLARE
  fn text;
  trigger_only_fns text[] := ARRAY[
    'audit_account_transactions',
    'audit_match_participants',
    'audit_match_results',
    'audit_match_scores',
    'auto_grant_admin_to_match_play',
    'check_and_cancel_match_after_confirmation',
    'check_and_process_cancellation_confirmations',
    'cleanup_orphaned_participants',
    'create_player_account',
    'create_win_posts_on_finalize',
    'handle_new_user',
    'handle_participant_removal',
    'log_golf_course_changes',
    'log_match_result_changes',
    'log_profile_changes',
    'notify_match_creator_on_join',
    'notify_on_cancellation_review',
    'notify_participants_on_finalize',
    'notify_support_request',
    'update_player_average_rating',
    'update_player_handicap_after_match',
    'validate_admin_role_assignment',
    'validate_coordinates',
    'validate_date_of_birth',
    'validate_final_scores',
    'validate_forfeited_players',
    'validate_handicap',
    'validate_hole_pars',
    'validate_match_score_strokes',
    'validate_profile_security',
    'write_audit_log',
    'reconcile_audit_log',
    'cleanup_consent_records_pii',
    'cleanup_expired_join_tokens',
    'cleanup_old_pin_attempts',
    'cleanup_old_temp_media',
    'flag_incomplete_matches',
    'recalculate_player_handicap',
    'sanitize_text_input'
  ];
BEGIN
  FOREACH fn IN ARRAY trigger_only_fns LOOP
    EXECUTE format(
      'REVOKE EXECUTE ON FUNCTION public.%I() FROM PUBLIC, anon, authenticated',
      fn
    );
  END LOOP;
EXCEPTION WHEN undefined_function THEN
  -- Some functions take args; handle individually below
  NULL;
END $$;

-- Functions with non-zero args that are trigger-only / admin-only / cron-only:
REVOKE EXECUTE ON FUNCTION public.reconcile_audit_log(integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recalculate_player_handicap(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sanitize_text_input(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.calculate_player_average_rating(uuid) FROM PUBLIC, anon, authenticated;

-- Admin-only RPCs: only authenticated callers (admin check is enforced inside)
-- We re-grant to authenticated so admins can call them through the API.
GRANT EXECUTE ON FUNCTION public.reconcile_audit_log(integer) TO authenticated;

-- Re-grant EXECUTE on admin-only resolve functions to authenticated (admin is enforced inside)
REVOKE EXECUTE ON FUNCTION public.admin_resolve_cancellation_review(uuid, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_resolve_incomplete_match(uuid, text, text) FROM PUBLIC, anon;

-- Lock down cleanup helpers (cron-only)
REVOKE EXECUTE ON FUNCTION public.flag_incomplete_matches() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_old_temp_media() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_consent_records_pii() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_expired_join_tokens() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_old_pin_attempts() FROM PUBLIC, anon, authenticated;

-- Re-grant flag_incomplete_matches to service_role (called by edge function)
GRANT EXECUTE ON FUNCTION public.flag_incomplete_matches() TO service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_old_temp_media() TO service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_consent_records_pii() TO service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_join_tokens() TO service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_old_pin_attempts() TO service_role;
