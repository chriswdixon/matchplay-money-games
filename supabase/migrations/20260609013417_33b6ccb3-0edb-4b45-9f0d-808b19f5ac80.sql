-- Tighten anon exposure flagged by the security scanner.

-- 1) Revoke SELECT from anon on tables whose policies are all authenticated-only.
--    RLS already denies anon every row; this also removes them from the anon GraphQL schema.
REVOKE SELECT ON public.bot_users FROM anon;
REVOKE SELECT ON public.match_chat_messages FROM anon;
REVOKE SELECT ON public.match_join_idempotency FROM anon;
REVOKE SELECT ON public.match_team_pins FROM anon;

-- 2) Lock down SECURITY DEFINER functions that the anon role should never execute.
--    Strip PUBLIC/anon/authenticated, then re-grant only the roles that genuinely need it.

-- Internal / financial / trigger functions: no client should call these directly.
REVOKE EXECUTE ON FUNCTION public.auto_credit_match_winnings() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_match_has_pin() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.credit_match_winnings_for(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.reconcile_match_buyins() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.reconcile_match_payouts() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_match_join_audit(uuid, uuid, text, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auto_credit_match_winnings() TO service_role;
GRANT EXECUTE ON FUNCTION public.sync_match_has_pin() TO service_role;
GRANT EXECUTE ON FUNCTION public.credit_match_winnings_for(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.reconcile_match_buyins() TO service_role;
GRANT EXECUTE ON FUNCTION public.reconcile_match_payouts() TO service_role;
GRANT EXECUTE ON FUNCTION public.log_match_join_audit(uuid, uuid, text, text, jsonb) TO service_role;

-- Client-callable flows: keep authenticated, drop anon.
REVOKE EXECUTE ON FUNCTION public.start_match_with_current_players(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.validate_and_join_match(uuid, text, integer, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.leave_match_with_refund(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_pending_review_matches(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_bot_user(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_match_with_current_players(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.validate_and_join_match(uuid, text, integer, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.leave_match_with_refund(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_pending_review_matches(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_bot_user(uuid) TO authenticated, service_role;