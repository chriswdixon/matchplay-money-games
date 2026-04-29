-- 1) Hide PIN columns on matches from broad SELECT; keep RPC-based access
REVOKE SELECT (pin, team2_pin, team3_pin, team4_pin) ON public.matches FROM anon, authenticated;

-- 2) Tighten consent_records: restrict to authenticated only (no anon access)
DROP POLICY IF EXISTS "Users can insert their own consent records" ON public.consent_records;
DROP POLICY IF EXISTS "Users can view their own consent records" ON public.consent_records;

CREATE POLICY "Users can insert their own consent records"
  ON public.consent_records
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can view their own consent records"
  ON public.consent_records
  FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

REVOKE ALL ON public.consent_records FROM anon;

-- 3) Revoke anon GraphQL/SELECT exposure on internal tables that should not be discoverable pre-auth
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'matches','match_participants','match_results','match_scores',
    'match_confirmations','match_cancellation_confirmations','match_cancellation_reviews',
    'match_join_tokens','match_win_posts','incomplete_match_reviews',
    'profiles','private_profile_data','profile_audit_log',
    'player_accounts','account_transactions','player_ratings',
    'favorite_courses','golf_courses','user_roles',
    'invites','age_verification_tokens','account_deletion_requests',
    'consent_records','double_down_participants','pin_attempts',
    'audit_log','audit_log_alerts','admin_access_log'
  ]
  LOOP
    EXECUTE format('REVOKE SELECT ON public.%I FROM anon', t);
  END LOOP;
END $$;