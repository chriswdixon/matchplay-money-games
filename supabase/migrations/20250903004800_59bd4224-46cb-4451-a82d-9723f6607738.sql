-- Create player_ratings table for golfer ratings
CREATE TABLE public.player_ratings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rater_id UUID NOT NULL,
  rated_player_id UUID NOT NULL,
  match_id UUID NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Ensure one rating per rater per rated player per match
  UNIQUE(rater_id, rated_player_id, match_id),
  
  -- Prevent self-rating
  CONSTRAINT no_self_rating CHECK (rater_id != rated_player_id)
);

-- Enable RLS
ALTER TABLE public.player_ratings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for player_ratings
-- Users can view ratings for matches they participated in
CREATE POLICY "Users can view ratings for their matches" 
ON public.player_ratings 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM match_participants mp 
    WHERE mp.match_id = player_ratings.match_id 
    AND mp.user_id = auth.uid()
  )
);

-- Users can insert ratings for players they played with
CREATE POLICY "Users can rate players they played with" 
ON public.player_ratings 
FOR INSERT 
WITH CHECK (
  auth.uid() = rater_id AND
  -- Ensure both rater and rated player were in the same match
  EXISTS (
    SELECT 1 FROM match_participants mp1 
    WHERE mp1.match_id = player_ratings.match_id 
    AND mp1.user_id = rater_id
  ) AND
  EXISTS (
    SELECT 1 FROM match_participants mp2 
    WHERE mp2.match_id = player_ratings.match_id 
    AND mp2.user_id = rated_player_id
  )
);

-- Users can update their own ratings
CREATE POLICY "Users can update their own ratings" 
ON public.player_ratings 
FOR UPDATE 
USING (auth.uid() = rater_id);

-- Add average_rating column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN average_rating DECIMAL(2,1) DEFAULT NULL;

-- Create function to calculate and update player average ratings
CREATE OR REPLACE FUNCTION public.calculate_player_average_rating(player_user_id UUID)
RETURNS DECIMAL(2,1)
LANGUAGE SQL
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ROUND(AVG(rating::DECIMAL), 1)
  FROM player_ratings 
  WHERE rated_player_id = player_user_id;
$$;

-- Create function to update player average rating
CREATE OR REPLACE FUNCTION public.update_player_average_rating()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Update the average rating for the rated player
  UPDATE profiles 
  SET average_rating = public.calculate_player_average_rating(
    CASE 
      WHEN TG_OP = 'DELETE' THEN OLD.rated_player_id
      ELSE NEW.rated_player_id
    END
  )
  WHERE user_id = CASE 
    WHEN TG_OP = 'DELETE' THEN OLD.rated_player_id
    ELSE NEW.rated_player_id
  END;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Create trigger to automatically update average ratings
CREATE TRIGGER update_player_rating_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.player_ratings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_player_average_rating();

-- Create trigger for updated_at timestamp
CREATE TRIGGER update_player_ratings_updated_at
  BEFORE UPDATE ON public.player_ratings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to get players that can be rated from a specific match
CREATE OR REPLACE FUNCTION public.get_rateable_players_for_match(match_id UUID, rater_user_id UUID)
RETURNS TABLE(
  user_id UUID,
  display_name TEXT,
  already_rated BOOLEAN
)
LANGUAGE SQL
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    p.user_id,
    p.display_name,
    EXISTS(
      SELECT 1 FROM player_ratings pr 
      WHERE pr.match_id = get_rateable_players_for_match.match_id 
      AND pr.rater_id = rater_user_id 
      AND pr.rated_player_id = p.user_id
    ) as already_rated
  FROM profiles p
  INNER JOIN match_participants mp ON mp.user_id = p.user_id
  WHERE mp.match_id = get_rateable_players_for_match.match_id
  AND p.user_id != rater_user_id; -- Exclude the rater themselves
$$;