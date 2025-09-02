-- Create matches table for golf match-making
CREATE TABLE public.matches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_name TEXT NOT NULL,
  location TEXT NOT NULL,
  scheduled_time TIMESTAMP WITH TIME ZONE NOT NULL,
  format TEXT NOT NULL,
  buy_in_amount INTEGER NOT NULL DEFAULT 0, -- in cents
  handicap_min INTEGER,
  handicap_max INTEGER,
  max_participants INTEGER NOT NULL DEFAULT 4,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'full', 'started', 'completed', 'cancelled')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create match participants table
CREATE TABLE public.match_participants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(match_id, user_id)
);

-- Enable RLS
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_participants ENABLE ROW LEVEL SECURITY;

-- RLS policies for matches
CREATE POLICY "Anyone can view open matches" 
ON public.matches 
FOR SELECT 
USING (status = 'open' OR created_by = auth.uid());

CREATE POLICY "Users can create matches" 
ON public.matches 
FOR INSERT 
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Match creators can update their matches" 
ON public.matches 
FOR UPDATE 
USING (auth.uid() = created_by);

-- RLS policies for match participants
CREATE POLICY "Anyone can view match participants" 
ON public.match_participants 
FOR SELECT 
USING (true);

CREATE POLICY "Users can join matches" 
ON public.match_participants 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can leave matches they joined" 
ON public.match_participants 
FOR DELETE 
USING (auth.uid() = user_id);

-- Add triggers for updated_at
CREATE TRIGGER update_matches_updated_at
  BEFORE UPDATE ON public.matches
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to get match participant count
CREATE OR REPLACE FUNCTION public.get_match_participant_count(match_id UUID)
RETURNS INTEGER
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::INTEGER
  FROM public.match_participants
  WHERE match_participants.match_id = get_match_participant_count.match_id;
$$;

-- Create function to check if user has joined a match
CREATE OR REPLACE FUNCTION public.user_joined_match(match_id UUID, user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.match_participants
    WHERE match_participants.match_id = user_joined_match.match_id
    AND match_participants.user_id = user_joined_match.user_id
  );
$$;