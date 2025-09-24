-- Create tables for golf scoring system

-- Table to track individual hole scores for each player in a match
CREATE TABLE public.match_scores (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  match_id uuid NOT NULL,
  player_id uuid NOT NULL,
  hole_number integer NOT NULL CHECK (hole_number >= 1 AND hole_number <= 18),
  strokes integer CHECK (strokes >= 1 AND strokes <= 10),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(match_id, player_id, hole_number)
);

-- Table to track match results and confirmations
CREATE TABLE public.match_results (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  match_id uuid NOT NULL UNIQUE,
  winner_id uuid,
  final_scores jsonb NOT NULL DEFAULT '{}',
  completed_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Table to track player confirmations of match results
CREATE TABLE public.match_confirmations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  match_id uuid NOT NULL,
  player_id uuid NOT NULL,
  confirmed boolean NOT NULL DEFAULT false,
  confirmed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(match_id, player_id)
);

-- Enable RLS on all tables
ALTER TABLE public.match_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_confirmations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for match_scores
CREATE POLICY "Players can view scores for matches they participate in" 
ON public.match_scores 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.match_participants mp 
    WHERE mp.match_id = match_scores.match_id 
    AND mp.user_id = auth.uid()
  )
);

CREATE POLICY "Players can insert their own scores" 
ON public.match_scores 
FOR INSERT 
WITH CHECK (
  auth.uid() = player_id 
  AND EXISTS (
    SELECT 1 FROM public.match_participants mp 
    WHERE mp.match_id = match_scores.match_id 
    AND mp.user_id = auth.uid()
  )
);

CREATE POLICY "Players can update their own scores" 
ON public.match_scores 
FOR UPDATE 
USING (
  auth.uid() = player_id 
  AND EXISTS (
    SELECT 1 FROM public.match_participants mp 
    WHERE mp.match_id = match_scores.match_id 
    AND mp.user_id = auth.uid()
  )
);

-- RLS Policies for match_results
CREATE POLICY "Players can view results for matches they participate in" 
ON public.match_results 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.match_participants mp 
    WHERE mp.match_id = match_results.match_id 
    AND mp.user_id = auth.uid()
  )
);

CREATE POLICY "System can manage match results" 
ON public.match_results 
FOR ALL 
USING (true)
WITH CHECK (true);

-- RLS Policies for match_confirmations
CREATE POLICY "Players can view confirmations for matches they participate in" 
ON public.match_confirmations 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.match_participants mp 
    WHERE mp.match_id = match_confirmations.match_id 
    AND mp.user_id = auth.uid()
  )
);

CREATE POLICY "Players can manage their own confirmations" 
ON public.match_confirmations 
FOR ALL 
USING (auth.uid() = player_id)
WITH CHECK (auth.uid() = player_id);

-- Add triggers for updated_at timestamps
CREATE TRIGGER update_match_scores_updated_at
BEFORE UPDATE ON public.match_scores
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_match_results_updated_at
BEFORE UPDATE ON public.match_results
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Function to start a match (change status to 'started')
CREATE OR REPLACE FUNCTION public.start_match(match_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if user is a participant in the match
  IF NOT EXISTS (
    SELECT 1 FROM public.match_participants mp 
    WHERE mp.match_id = start_match.match_id 
    AND mp.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'You must be a participant to start this match';
  END IF;
  
  -- Check if match is full
  IF NOT EXISTS (
    SELECT 1 FROM public.matches m
    WHERE m.id = start_match.match_id
    AND (
      SELECT COUNT(*) FROM public.match_participants mp2 
      WHERE mp2.match_id = start_match.match_id
    ) >= m.max_participants
  ) THEN
    RAISE EXCEPTION 'Match must be full to start';
  END IF;
  
  -- Update match status to started
  UPDATE public.matches 
  SET status = 'started', updated_at = now()
  WHERE id = start_match.match_id 
  AND status = 'open';
  
  RETURN FOUND;
END;
$$;

-- Function to calculate and finalize match results
CREATE OR REPLACE FUNCTION public.finalize_match_results(match_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  participant_record RECORD;
  winner_record RECORD;
  final_scores_json jsonb := '{}';
  player_total integer;
  lowest_score integer := 999;
  winner_player_id uuid;
BEGIN
  -- Check if user is a participant
  IF NOT EXISTS (
    SELECT 1 FROM public.match_participants mp 
    WHERE mp.match_id = finalize_match_results.match_id 
    AND mp.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'You must be a participant to finalize results';
  END IF;
  
  -- Calculate total scores for each player
  FOR participant_record IN 
    SELECT mp.user_id, p.display_name
    FROM public.match_participants mp
    JOIN public.profiles p ON p.user_id = mp.user_id
    WHERE mp.match_id = finalize_match_results.match_id
  LOOP
    -- Calculate total strokes for this player
    SELECT COALESCE(SUM(strokes), 0) INTO player_total
    FROM public.match_scores ms
    WHERE ms.match_id = finalize_match_results.match_id
    AND ms.player_id = participant_record.user_id;
    
    -- Add to final scores JSON
    final_scores_json := jsonb_set(
      final_scores_json,
      ARRAY[participant_record.user_id::text],
      jsonb_build_object(
        'player_name', participant_record.display_name,
        'total_strokes', player_total
      )
    );
    
    -- Track lowest score
    IF player_total < lowest_score AND player_total > 0 THEN
      lowest_score := player_total;
      winner_player_id := participant_record.user_id;
    END IF;
  END LOOP;
  
  -- Insert or update match results
  INSERT INTO public.match_results (match_id, winner_id, final_scores)
  VALUES (finalize_match_results.match_id, winner_player_id, final_scores_json)
  ON CONFLICT (match_id) 
  DO UPDATE SET 
    winner_id = winner_player_id,
    final_scores = final_scores_json,
    updated_at = now();
  
  -- Update match status to completed
  UPDATE public.matches 
  SET status = 'completed', updated_at = now()
  WHERE id = finalize_match_results.match_id;
  
  RETURN true;
END;
$$;

-- Enable realtime for score tracking
ALTER TABLE public.match_scores REPLICA IDENTITY FULL;
ALTER TABLE public.match_results REPLICA IDENTITY FULL;
ALTER TABLE public.match_confirmations REPLICA IDENTITY FULL;

-- Add tables to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.match_scores;
ALTER PUBLICATION supabase_realtime ADD TABLE public.match_results;
ALTER PUBLICATION supabase_realtime ADD TABLE public.match_confirmations;