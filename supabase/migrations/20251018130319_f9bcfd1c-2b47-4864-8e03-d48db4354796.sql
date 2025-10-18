-- Add missing indexes on foreign key columns for better join performance

-- Invites table
CREATE INDEX IF NOT EXISTS idx_invites_used_by ON public.invites(used_by);

-- Match cancellation reviews table
CREATE INDEX IF NOT EXISTS idx_match_cancellation_reviews_reviewed_by ON public.match_cancellation_reviews(reviewed_by);

-- Matches table - team PIN creators
CREATE INDEX IF NOT EXISTS idx_matches_team1_pin_creator ON public.matches(team1_pin_creator);
CREATE INDEX IF NOT EXISTS idx_matches_team2_pin_creator ON public.matches(team2_pin_creator);
CREATE INDEX IF NOT EXISTS idx_matches_team3_pin_creator ON public.matches(team3_pin_creator);
CREATE INDEX IF NOT EXISTS idx_matches_team4_pin_creator ON public.matches(team4_pin_creator);

-- Profile audit log table
CREATE INDEX IF NOT EXISTS idx_profile_audit_log_profile_id ON public.profile_audit_log(profile_id);