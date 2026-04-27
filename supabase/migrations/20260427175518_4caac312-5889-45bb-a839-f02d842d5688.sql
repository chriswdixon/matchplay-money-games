
-- Revoke EXECUTE from authenticated on every SECURITY DEFINER function in public.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT n.nspname AS schema_name, p.proname AS func_name,
           pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef = true
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %I.%I(%s) FROM PUBLIC, anon, authenticated;',
                   r.schema_name, r.func_name, r.args);
  END LOOP;
END $$;

-- Re-grant EXECUTE to authenticated only for the allowlist of intentionally callable functions.
DO $$
DECLARE
  r record;
  callable_funcs text[] := ARRAY[
    'has_role',
    'is_user_in_match',
    'is_user_match_creator',
    'is_user_match_participant',
    'is_match_participant',
    'is_match_creator',
    'is_profile_owner',
    'realtime_topic_match_id',
    'validate_invite',
    'link_invite_to_user',
    'get_user_private_data',
    'get_public_profile',
    'get_match_creator_info',
    'get_match_participant_count',
    'get_match_with_location_filter',
    'get_nearby_matches',
    'get_rateable_players_for_match',
    'calculate_distance',
    'calculate_player_average_rating',
    'validate_and_join_match',
    'start_match',
    'leave_match_with_dnf',
    'record_double_down_vote',
    'create_match_join_token',
    'finalize_match_results'
  ];
BEGIN
  FOR r IN
    SELECT n.nspname AS schema_name, p.proname AS func_name,
           pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef = true
      AND p.proname = ANY(callable_funcs)
  LOOP
    EXECUTE format('GRANT EXECUTE ON FUNCTION %I.%I(%s) TO authenticated;',
                   r.schema_name, r.func_name, r.args);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %I.%I(%s) TO service_role;',
                   r.schema_name, r.func_name, r.args);
  END LOOP;
END $$;
