-- Performance Optimization: Wrap auth.uid() in subqueries and add indexes
-- This reduces redundant auth.uid() calls and improves query planning

-- ==========================================
-- MATCHES TABLE
-- ==========================================
DROP POLICY IF EXISTS "Creators can manage their matches" ON public.matches;
DROP POLICY IF EXISTS "Users can create matches" ON public.matches;
DROP POLICY IF EXISTS "Users can view matches they participate in or open matches" ON public.matches;
DROP POLICY IF EXISTS "Match creators can delete their matches" ON public.matches;

CREATE POLICY "Creators can manage their matches"
ON public.matches
FOR ALL
TO authenticated
USING (created_by = (SELECT auth.uid()))
WITH CHECK (created_by = (SELECT auth.uid()));

CREATE POLICY "Users can create matches"
ON public.matches
FOR INSERT
TO authenticated
WITH CHECK (created_by = (SELECT auth.uid()));

CREATE POLICY "Users can view matches they participate in or open matches"
ON public.matches
FOR SELECT
TO authenticated
USING (
  status = 'open' 
  OR created_by = (SELECT auth.uid()) 
  OR is_user_match_participant(id, (SELECT auth.uid()))
);

CREATE POLICY "Match creators can delete their matches"
ON public.matches
FOR DELETE
TO authenticated
USING (created_by = (SELECT auth.uid()));

CREATE INDEX IF NOT EXISTS idx_matches_created_by ON public.matches(created_by);
CREATE INDEX IF NOT EXISTS idx_matches_status ON public.matches(status);

-- ==========================================
-- MATCH PARTICIPANTS TABLE
-- ==========================================
DROP POLICY IF EXISTS "Users can join matches via secure function" ON public.match_participants;
DROP POLICY IF EXISTS "Users can leave matches they joined" ON public.match_participants;
DROP POLICY IF EXISTS "Users can update their own participation" ON public.match_participants;
DROP POLICY IF EXISTS "Users can view match participants" ON public.match_participants;

CREATE POLICY "Users can join matches via secure function"
ON public.match_participants
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM matches m
    WHERE m.id = match_participants.match_id 
    AND (m.created_by = (SELECT auth.uid()) OR current_setting('app.secure_join_allowed', true) = 'true')
  )
);

CREATE POLICY "Users can leave matches they joined"
ON public.match_participants
FOR DELETE
TO authenticated
USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can update their own participation"
ON public.match_participants
FOR UPDATE
TO authenticated
USING (user_id = (SELECT auth.uid()))
WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can view match participants"
ON public.match_participants
FOR SELECT
TO authenticated
USING (
  user_id = (SELECT auth.uid()) 
  OR is_user_match_creator(match_id, (SELECT auth.uid()))
);

CREATE INDEX IF NOT EXISTS idx_match_participants_user_id ON public.match_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_match_participants_match_id ON public.match_participants(match_id);

-- ==========================================
-- MATCH SCORES TABLE
-- ==========================================
DROP POLICY IF EXISTS "Players can insert their own scores" ON public.match_scores;
DROP POLICY IF EXISTS "Players can update their own scores" ON public.match_scores;
DROP POLICY IF EXISTS "Players can view scores for matches they participate in" ON public.match_scores;

CREATE POLICY "Players can insert their own scores"
ON public.match_scores
FOR INSERT
TO authenticated
WITH CHECK (
  player_id = (SELECT auth.uid()) 
  AND EXISTS (
    SELECT 1 FROM match_participants mp
    WHERE mp.match_id = match_scores.match_id AND mp.user_id = (SELECT auth.uid())
  )
);

CREATE POLICY "Players can update their own scores"
ON public.match_scores
FOR UPDATE
TO authenticated
USING (
  player_id = (SELECT auth.uid()) 
  AND EXISTS (
    SELECT 1 FROM match_participants mp
    WHERE mp.match_id = match_scores.match_id AND mp.user_id = (SELECT auth.uid())
  )
);

CREATE POLICY "Players can view scores for matches they participate in"
ON public.match_scores
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM match_participants mp
    WHERE mp.match_id = match_scores.match_id AND mp.user_id = (SELECT auth.uid())
  )
);

CREATE INDEX IF NOT EXISTS idx_match_scores_player_id ON public.match_scores(player_id);
CREATE INDEX IF NOT EXISTS idx_match_scores_match_id ON public.match_scores(match_id);

-- ==========================================
-- MATCH RESULTS TABLE
-- ==========================================
DROP POLICY IF EXISTS "Match creators can delete results" ON public.match_results;
DROP POLICY IF EXISTS "Match participants can insert results" ON public.match_results;
DROP POLICY IF EXISTS "Match participants can update results" ON public.match_results;
DROP POLICY IF EXISTS "Players can view results for matches they participate in" ON public.match_results;

CREATE POLICY "Match creators can delete results"
ON public.match_results
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM matches m
    WHERE m.id = match_results.match_id AND m.created_by = (SELECT auth.uid())
  )
);

CREATE POLICY "Match participants can insert results"
ON public.match_results
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM match_participants mp
    WHERE mp.match_id = match_results.match_id AND mp.user_id = (SELECT auth.uid())
  )
);

CREATE POLICY "Match participants can update results"
ON public.match_results
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM match_participants mp
    WHERE mp.match_id = match_results.match_id AND mp.user_id = (SELECT auth.uid())
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM match_participants mp
    WHERE mp.match_id = match_results.match_id AND mp.user_id = (SELECT auth.uid())
  )
);

CREATE POLICY "Players can view results for matches they participate in"
ON public.match_results
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM match_participants mp
    WHERE mp.match_id = match_results.match_id AND mp.user_id = (SELECT auth.uid())
  )
);

CREATE INDEX IF NOT EXISTS idx_match_results_match_id ON public.match_results(match_id);

-- ==========================================
-- MATCH CONFIRMATIONS TABLE
-- ==========================================
DROP POLICY IF EXISTS "Players can delete their own confirmations" ON public.match_confirmations;
DROP POLICY IF EXISTS "Players can insert confirmations for their matches" ON public.match_confirmations;
DROP POLICY IF EXISTS "Players can update their own confirmations" ON public.match_confirmations;
DROP POLICY IF EXISTS "Players can view confirmations for matches they participate in" ON public.match_confirmations;

CREATE POLICY "Players can delete their own confirmations"
ON public.match_confirmations
FOR DELETE
TO authenticated
USING (player_id = (SELECT auth.uid()));

CREATE POLICY "Players can insert confirmations for their matches"
ON public.match_confirmations
FOR INSERT
TO authenticated
WITH CHECK (
  player_id = (SELECT auth.uid()) 
  AND EXISTS (
    SELECT 1 FROM match_participants mp
    WHERE mp.match_id = match_confirmations.match_id AND mp.user_id = (SELECT auth.uid())
  )
);

CREATE POLICY "Players can update their own confirmations"
ON public.match_confirmations
FOR UPDATE
TO authenticated
USING (player_id = (SELECT auth.uid()))
WITH CHECK (player_id = (SELECT auth.uid()));

CREATE POLICY "Players can view confirmations for matches they participate in"
ON public.match_confirmations
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM match_participants mp
    WHERE mp.match_id = match_confirmations.match_id AND mp.user_id = (SELECT auth.uid())
  )
);

CREATE INDEX IF NOT EXISTS idx_match_confirmations_player_id ON public.match_confirmations(player_id);
CREATE INDEX IF NOT EXISTS idx_match_confirmations_match_id ON public.match_confirmations(match_id);

-- ==========================================
-- MATCH CANCELLATION CONFIRMATIONS TABLE
-- ==========================================
DROP POLICY IF EXISTS "Players can confirm cancellations" ON public.match_cancellation_confirmations;
DROP POLICY IF EXISTS "Players can update their confirmations" ON public.match_cancellation_confirmations;
DROP POLICY IF EXISTS "Players can view confirmations for their matches" ON public.match_cancellation_confirmations;

CREATE POLICY "Players can confirm cancellations"
ON public.match_cancellation_confirmations
FOR INSERT
TO authenticated
WITH CHECK (
  confirming_player_id = (SELECT auth.uid()) 
  AND EXISTS (
    SELECT 1 FROM match_participants mp
    WHERE mp.match_id = match_cancellation_confirmations.match_id AND mp.user_id = (SELECT auth.uid())
  )
);

CREATE POLICY "Players can update their confirmations"
ON public.match_cancellation_confirmations
FOR UPDATE
TO authenticated
USING (confirming_player_id = (SELECT auth.uid()));

CREATE POLICY "Players can view confirmations for their matches"
ON public.match_cancellation_confirmations
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM match_participants mp
    WHERE mp.match_id = match_cancellation_confirmations.match_id AND mp.user_id = (SELECT auth.uid())
  )
);

CREATE INDEX IF NOT EXISTS idx_cancellation_confirmations_confirming_player ON public.match_cancellation_confirmations(confirming_player_id);
CREATE INDEX IF NOT EXISTS idx_cancellation_confirmations_cancelling_player ON public.match_cancellation_confirmations(cancelling_player_id);
CREATE INDEX IF NOT EXISTS idx_cancellation_confirmations_match_id ON public.match_cancellation_confirmations(match_id);

-- ==========================================
-- PLAYER ACCOUNTS TABLE
-- ==========================================
DROP POLICY IF EXISTS "Users can insert their own account" ON public.player_accounts;
DROP POLICY IF EXISTS "Users can view their own account" ON public.player_accounts;

CREATE POLICY "Users can insert their own account"
ON public.player_accounts
FOR INSERT
TO authenticated
WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can view their own account"
ON public.player_accounts
FOR SELECT
TO authenticated
USING (user_id = (SELECT auth.uid()) OR has_role((SELECT auth.uid()), 'admin'));

CREATE INDEX IF NOT EXISTS idx_player_accounts_user_id ON public.player_accounts(user_id);

-- ==========================================
-- ACCOUNT TRANSACTIONS TABLE
-- ==========================================
DROP POLICY IF EXISTS "Users can view their own transactions" ON public.account_transactions;

CREATE POLICY "Users can view their own transactions"
ON public.account_transactions
FOR SELECT
TO authenticated
USING (user_id = (SELECT auth.uid()) OR has_role((SELECT auth.uid()), 'admin'));

CREATE INDEX IF NOT EXISTS idx_account_transactions_user_id ON public.account_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_account_transactions_account_id ON public.account_transactions(account_id);

-- ==========================================
-- PLAYER RATINGS TABLE
-- ==========================================
DROP POLICY IF EXISTS "Users can rate players they played with" ON public.player_ratings;
DROP POLICY IF EXISTS "Users can update their own ratings" ON public.player_ratings;
DROP POLICY IF EXISTS "Users can view ratings for their matches" ON public.player_ratings;

CREATE POLICY "Users can rate players they played with"
ON public.player_ratings
FOR INSERT
TO authenticated
WITH CHECK (
  rater_id = (SELECT auth.uid()) 
  AND EXISTS (
    SELECT 1 FROM match_participants mp1
    WHERE mp1.match_id = player_ratings.match_id AND mp1.user_id = player_ratings.rater_id
  ) 
  AND EXISTS (
    SELECT 1 FROM match_participants mp2
    WHERE mp2.match_id = player_ratings.match_id AND mp2.user_id = player_ratings.rated_player_id
  )
);

CREATE POLICY "Users can update their own ratings"
ON public.player_ratings
FOR UPDATE
TO authenticated
USING (rater_id = (SELECT auth.uid()));

CREATE POLICY "Users can view ratings for their matches"
ON public.player_ratings
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM match_participants mp
    WHERE mp.match_id = player_ratings.match_id AND mp.user_id = (SELECT auth.uid())
  )
);

CREATE INDEX IF NOT EXISTS idx_player_ratings_rater_id ON public.player_ratings(rater_id);
CREATE INDEX IF NOT EXISTS idx_player_ratings_rated_player_id ON public.player_ratings(rated_player_id);
CREATE INDEX IF NOT EXISTS idx_player_ratings_match_id ON public.player_ratings(match_id);

-- ==========================================
-- PROFILES TABLE
-- ==========================================
DROP POLICY IF EXISTS "Authenticated users can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert only their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update only their own profile" ON public.profiles;

CREATE POLICY "Authenticated users can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING ((SELECT auth.uid()) IS NOT NULL);

CREATE POLICY "Users can insert only their own profile"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can update only their own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (user_id = (SELECT auth.uid()))
WITH CHECK (user_id = (SELECT auth.uid()));

CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles(user_id);

-- ==========================================
-- PRIVATE PROFILE DATA TABLE
-- ==========================================
DROP POLICY IF EXISTS "Users can insert only their own private data" ON public.private_profile_data;
DROP POLICY IF EXISTS "Users can update only their own private data" ON public.private_profile_data;
DROP POLICY IF EXISTS "Users can view only their own private data" ON public.private_profile_data;

CREATE POLICY "Users can insert only their own private data"
ON public.private_profile_data
FOR INSERT
TO authenticated
WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can update only their own private data"
ON public.private_profile_data
FOR UPDATE
TO authenticated
USING (user_id = (SELECT auth.uid()))
WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can view only their own private data"
ON public.private_profile_data
FOR SELECT
TO authenticated
USING (user_id = (SELECT auth.uid()) OR has_role((SELECT auth.uid()), 'admin'));

CREATE INDEX IF NOT EXISTS idx_private_profile_data_user_id ON public.private_profile_data(user_id);

-- ==========================================
-- PROFILE AUDIT LOG TABLE
-- ==========================================
DROP POLICY IF EXISTS "Users can view their own profile audit logs" ON public.profile_audit_log;

CREATE POLICY "Users can view their own profile audit logs"
ON public.profile_audit_log
FOR SELECT
TO authenticated
USING (user_id = (SELECT auth.uid()));

CREATE INDEX IF NOT EXISTS idx_profile_audit_log_user_id ON public.profile_audit_log(user_id);

-- ==========================================
-- FAVORITE COURSES TABLE
-- ==========================================
DROP POLICY IF EXISTS "Users can add their own favorite courses" ON public.favorite_courses;
DROP POLICY IF EXISTS "Users can delete their own favorite courses" ON public.favorite_courses;
DROP POLICY IF EXISTS "Users can view their own favorite courses" ON public.favorite_courses;

CREATE POLICY "Users can add their own favorite courses"
ON public.favorite_courses
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = (SELECT auth.uid()) 
  AND (SELECT COUNT(*) FROM favorite_courses WHERE user_id = (SELECT auth.uid())) < 5
);

CREATE POLICY "Users can delete their own favorite courses"
ON public.favorite_courses
FOR DELETE
TO authenticated
USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can view their own favorite courses"
ON public.favorite_courses
FOR SELECT
TO authenticated
USING (user_id = (SELECT auth.uid()));

CREATE INDEX IF NOT EXISTS idx_favorite_courses_user_id ON public.favorite_courses(user_id);

-- ==========================================
-- USER ROLES TABLE
-- ==========================================
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;

CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Admins can view all roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (has_role((SELECT auth.uid()), 'admin'));

CREATE POLICY "Admins can manage roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (has_role((SELECT auth.uid()), 'admin'))
WITH CHECK (has_role((SELECT auth.uid()), 'admin'));

CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON public.user_roles(role);

-- ==========================================
-- DOUBLE DOWN PARTICIPANTS TABLE
-- ==========================================
DROP POLICY IF EXISTS "Users can insert their own double down participation" ON public.double_down_participants;
DROP POLICY IF EXISTS "Users can update their own double down participation" ON public.double_down_participants;
DROP POLICY IF EXISTS "Users can view their own double down status" ON public.double_down_participants;
DROP POLICY IF EXISTS "Match participants can view all double down statuses" ON public.double_down_participants;

CREATE POLICY "Users can insert their own double down participation"
ON public.double_down_participants
FOR INSERT
TO authenticated
WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can update their own double down participation"
ON public.double_down_participants
FOR UPDATE
TO authenticated
USING (user_id = (SELECT auth.uid()))
WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can view their own double down status"
ON public.double_down_participants
FOR SELECT
TO authenticated
USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Match participants can view all double down statuses"
ON public.double_down_participants
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM match_participants mp
    WHERE mp.match_id = double_down_participants.match_id AND mp.user_id = (SELECT auth.uid())
  )
);

CREATE INDEX IF NOT EXISTS idx_double_down_participants_user_id ON public.double_down_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_double_down_participants_match_id ON public.double_down_participants(match_id);

-- ==========================================
-- PIN ATTEMPTS TABLE
-- ==========================================
DROP POLICY IF EXISTS "Service role can insert attempts" ON public.pin_attempts;
DROP POLICY IF EXISTS "Users can view their own attempts" ON public.pin_attempts;

CREATE POLICY "Service role can insert attempts"
ON public.pin_attempts
FOR INSERT
TO authenticated
WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can view their own attempts"
ON public.pin_attempts
FOR SELECT
TO authenticated
USING (user_id = (SELECT auth.uid()));

CREATE INDEX IF NOT EXISTS idx_pin_attempts_user_id ON public.pin_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_pin_attempts_match_id ON public.pin_attempts(match_id);

-- ==========================================
-- MATCH JOIN TOKENS TABLE
-- ==========================================
DROP POLICY IF EXISTS "Match participants can view tokens" ON public.match_join_tokens;
DROP POLICY IF EXISTS "Users can view tokens they created" ON public.match_join_tokens;

CREATE POLICY "Match participants can view tokens"
ON public.match_join_tokens
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM match_participants mp
    WHERE mp.match_id = match_join_tokens.match_id AND mp.user_id = (SELECT auth.uid())
  )
);

CREATE POLICY "Users can view tokens they created"
ON public.match_join_tokens
FOR SELECT
TO authenticated
USING (created_by = (SELECT auth.uid()));

CREATE INDEX IF NOT EXISTS idx_match_join_tokens_created_by ON public.match_join_tokens(created_by);
CREATE INDEX IF NOT EXISTS idx_match_join_tokens_match_id ON public.match_join_tokens(match_id);

-- ==========================================
-- INVITES TABLE
-- ==========================================
DROP POLICY IF EXISTS "Admins can create invites" ON public.invites;
DROP POLICY IF EXISTS "Admins can view all invites" ON public.invites;

CREATE POLICY "Admins can create invites"
ON public.invites
FOR INSERT
TO authenticated
WITH CHECK (has_role((SELECT auth.uid()), 'admin') AND created_by = (SELECT auth.uid()));

CREATE POLICY "Admins can view all invites"
ON public.invites
FOR SELECT
TO authenticated
USING (has_role((SELECT auth.uid()), 'admin'));

CREATE INDEX IF NOT EXISTS idx_invites_created_by ON public.invites(created_by);
CREATE INDEX IF NOT EXISTS idx_invites_code ON public.invites(code);

-- ==========================================
-- ADMIN ACCESS LOG TABLE
-- ==========================================
DROP POLICY IF EXISTS "Admins can view access logs" ON public.admin_access_log;

CREATE POLICY "Admins can view access logs"
ON public.admin_access_log
FOR SELECT
TO authenticated
USING (has_role((SELECT auth.uid()), 'admin'));

CREATE INDEX IF NOT EXISTS idx_admin_access_log_admin_user_id ON public.admin_access_log(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_access_log_accessed_user_id ON public.admin_access_log(accessed_user_id);

-- ==========================================
-- MATCH CANCELLATION REVIEWS TABLE
-- ==========================================
DROP POLICY IF EXISTS "Admins can view all reviews" ON public.match_cancellation_reviews;
DROP POLICY IF EXISTS "Admins can update reviews" ON public.match_cancellation_reviews;

CREATE POLICY "Admins can view all reviews"
ON public.match_cancellation_reviews
FOR SELECT
TO authenticated
USING (has_role((SELECT auth.uid()), 'admin'));

CREATE POLICY "Admins can update reviews"
ON public.match_cancellation_reviews
FOR UPDATE
TO authenticated
USING (has_role((SELECT auth.uid()), 'admin'))
WITH CHECK (has_role((SELECT auth.uid()), 'admin'));

CREATE INDEX IF NOT EXISTS idx_cancellation_reviews_match_id ON public.match_cancellation_reviews(match_id);
CREATE INDEX IF NOT EXISTS idx_cancellation_reviews_status ON public.match_cancellation_reviews(status);

-- ==========================================
-- GOLF COURSES TABLE
-- ==========================================
DROP POLICY IF EXISTS "Authenticated users can create golf courses" ON public.golf_courses;
DROP POLICY IF EXISTS "Admins can update golf courses" ON public.golf_courses;
DROP POLICY IF EXISTS "Admins can delete golf courses" ON public.golf_courses;

CREATE POLICY "Authenticated users can create golf courses"
ON public.golf_courses
FOR INSERT
TO authenticated
WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

CREATE POLICY "Admins can update golf courses"
ON public.golf_courses
FOR UPDATE
TO authenticated
USING (has_role((SELECT auth.uid()), 'admin'))
WITH CHECK (has_role((SELECT auth.uid()), 'admin'));

CREATE POLICY "Admins can delete golf courses"
ON public.golf_courses
FOR DELETE
TO authenticated
USING (has_role((SELECT auth.uid()), 'admin'));

-- ==========================================
-- SOCIAL LINKS TABLE
-- ==========================================
DROP POLICY IF EXISTS "Admins can insert social links" ON public.social_links;
DROP POLICY IF EXISTS "Admins can update social links" ON public.social_links;
DROP POLICY IF EXISTS "Admins can delete social links" ON public.social_links;

CREATE POLICY "Admins can insert social links"
ON public.social_links
FOR INSERT
TO authenticated
WITH CHECK (has_role((SELECT auth.uid()), 'admin'));

CREATE POLICY "Admins can update social links"
ON public.social_links
FOR UPDATE
TO authenticated
USING (has_role((SELECT auth.uid()), 'admin'))
WITH CHECK (has_role((SELECT auth.uid()), 'admin'));

CREATE POLICY "Admins can delete social links"
ON public.social_links
FOR DELETE
TO authenticated
USING (has_role((SELECT auth.uid()), 'admin'));