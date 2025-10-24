-- Create table for incomplete match reviews
CREATE TABLE IF NOT EXISTS public.incomplete_match_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  flagged_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  match_started_at TIMESTAMP WITH TIME ZONE NOT NULL,
  incomplete_players JSONB NOT NULL DEFAULT '[]'::jsonb,
  completed_players JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, resolved, cancelled
  admin_decision TEXT,
  admin_notes TEXT,
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add RLS policies
ALTER TABLE public.incomplete_match_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all incomplete match reviews"
  ON public.incomplete_match_reviews
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role can insert reviews"
  ON public.incomplete_match_reviews
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Admins can update reviews"
  ON public.incomplete_match_reviews
  FOR UPDATE
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- Create index for faster queries
CREATE INDEX idx_incomplete_match_reviews_status ON public.incomplete_match_reviews(status);
CREATE INDEX idx_incomplete_match_reviews_match_id ON public.incomplete_match_reviews(match_id);

-- Function to check and flag incomplete matches (24+ hours old)
CREATE OR REPLACE FUNCTION public.flag_incomplete_matches()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  match_record RECORD;
  incomplete_players_json JSONB;
  completed_players_json JSONB;
  flagged_count INTEGER := 0;
BEGIN
  -- Find matches that are:
  -- 1. Status is 'started'
  -- 2. Started more than 24 hours ago
  -- 3. Not already flagged for review
  FOR match_record IN
    SELECT 
      m.id,
      m.created_at,
      m.scheduled_time,
      m.course_name,
      m.buy_in_amount
    FROM public.matches m
    WHERE m.status = 'started'
      AND m.created_at < (now() - INTERVAL '24 hours')
      AND NOT EXISTS (
        SELECT 1 FROM public.incomplete_match_reviews imr
        WHERE imr.match_id = m.id AND imr.status = 'pending'
      )
  LOOP
    -- Determine which players completed 18 holes and which didn't
    SELECT 
      COALESCE(jsonb_agg(
        jsonb_build_object(
          'user_id', mp.user_id,
          'display_name', p.display_name,
          'holes_completed', COALESCE(hole_counts.count, 0)
        )
      ) FILTER (WHERE COALESCE(hole_counts.count, 0) < 18), '[]'::jsonb),
      COALESCE(jsonb_agg(
        jsonb_build_object(
          'user_id', mp.user_id,
          'display_name', p.display_name,
          'holes_completed', hole_counts.count
        )
      ) FILTER (WHERE hole_counts.count >= 18), '[]'::jsonb)
    INTO incomplete_players_json, completed_players_json
    FROM public.match_participants mp
    JOIN public.profiles p ON p.user_id = mp.user_id
    LEFT JOIN (
      SELECT player_id, COUNT(DISTINCT hole_number) as count
      FROM public.match_scores
      WHERE match_id = match_record.id
      GROUP BY player_id
    ) hole_counts ON hole_counts.player_id = mp.user_id
    WHERE mp.match_id = match_record.id
      AND mp.status = 'active';

    -- Only flag if there are incomplete players
    IF jsonb_array_length(incomplete_players_json) > 0 THEN
      INSERT INTO public.incomplete_match_reviews (
        match_id,
        match_started_at,
        incomplete_players,
        completed_players,
        status
      ) VALUES (
        match_record.id,
        match_record.created_at,
        incomplete_players_json,
        completed_players_json,
        'pending'
      );
      
      flagged_count := flagged_count + 1;
    END IF;
  END LOOP;

  RETURN flagged_count;
END;
$$;

-- Function for admins to resolve incomplete match reviews
CREATE OR REPLACE FUNCTION public.admin_resolve_incomplete_match(
  p_review_id UUID,
  p_decision TEXT,
  p_admin_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  review_record RECORD;
  match_buy_in INTEGER;
  incomplete_player JSONB;
  forfeit_count INTEGER := 0;
BEGIN
  -- Security: Only admins can resolve reviews
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Access denied: Only admins can resolve incomplete match reviews';
  END IF;

  -- Get review details
  SELECT * INTO review_record
  FROM public.incomplete_match_reviews
  WHERE id = p_review_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Review not found';
  END IF;

  IF review_record.status != 'pending' THEN
    RAISE EXCEPTION 'Review has already been processed';
  END IF;

  -- Get match buy-in
  SELECT buy_in_amount INTO match_buy_in
  FROM public.matches
  WHERE id = review_record.match_id;

  -- Process based on decision
  IF p_decision = 'forfeit_incomplete' THEN
    -- Incomplete players forfeit their buy-ins
    -- No refunds, winnings go to completed players
    
    -- Mark match as completed
    UPDATE public.matches
    SET status = 'completed', updated_at = now()
    WHERE id = review_record.match_id;
    
    -- Record forfeitures in match_results
    INSERT INTO public.match_results (
      match_id,
      final_scores,
      forfeited_players
    )
    SELECT
      review_record.match_id,
      '{}'::jsonb,
      review_record.incomplete_players
    ON CONFLICT (match_id) DO UPDATE
    SET forfeited_players = EXCLUDED.forfeited_players;
    
  ELSIF p_decision = 'cancel_match' THEN
    -- Cancel the match entirely
    UPDATE public.matches
    SET status = 'cancelled', updated_at = now()
    WHERE id = review_record.match_id;
    
    -- Mark all participants as left
    UPDATE public.match_participants
    SET status = 'left'
    WHERE match_id = review_record.match_id;
    
  ELSE
    RAISE EXCEPTION 'Invalid decision: must be forfeit_incomplete or cancel_match';
  END IF;

  -- Update review status
  UPDATE public.incomplete_match_reviews
  SET 
    status = 'resolved',
    admin_decision = p_decision,
    admin_notes = p_admin_notes,
    reviewed_by = auth.uid(),
    reviewed_at = now()
  WHERE id = p_review_id;

  -- Log the action
  INSERT INTO public.admin_access_log (
    admin_user_id,
    accessed_table,
    action,
    metadata
  ) VALUES (
    auth.uid(),
    'incomplete_match_reviews',
    'RESOLVE_INCOMPLETE_MATCH',
    jsonb_build_object(
      'review_id', p_review_id,
      'match_id', review_record.match_id,
      'decision', p_decision
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'decision', p_decision,
    'incomplete_players', review_record.incomplete_players
  );
END;
$$;