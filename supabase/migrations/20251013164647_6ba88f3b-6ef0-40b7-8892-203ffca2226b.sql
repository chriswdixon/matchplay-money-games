-- Add 'double_down' to transaction_type enum
ALTER TYPE transaction_type ADD VALUE IF NOT EXISTS 'double_down';

-- Create double_down_participants table
CREATE TABLE IF NOT EXISTS public.double_down_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID REFERENCES public.matches(id) ON DELETE CASCADE NOT NULL,
  user_id UUID NOT NULL,
  opted_in BOOLEAN NOT NULL DEFAULT false,
  responded BOOLEAN NOT NULL DEFAULT false,
  additional_buyin INTEGER NOT NULL DEFAULT 0,
  payment_processed BOOLEAN NOT NULL DEFAULT false,
  payment_intent_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(match_id, user_id)
);

-- Enable RLS on double_down_participants
ALTER TABLE public.double_down_participants ENABLE ROW LEVEL SECURITY;

-- RLS Policies for double_down_participants
CREATE POLICY "Users can view their own double down status"
ON public.double_down_participants
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own double down participation"
ON public.double_down_participants
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own double down participation"
ON public.double_down_participants
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Match participants can view all double down statuses"
ON public.double_down_participants
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.match_participants mp
    WHERE mp.match_id = double_down_participants.match_id
    AND mp.user_id = auth.uid()
  )
);

-- Add columns to matches table
ALTER TABLE public.matches 
ADD COLUMN IF NOT EXISTS double_down_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS double_down_amount INTEGER,
ADD COLUMN IF NOT EXISTS double_down_finalized BOOLEAN DEFAULT false;

-- Enable realtime for double_down_participants
ALTER TABLE public.double_down_participants REPLICA IDENTITY FULL;

-- Add to realtime publication if not already added
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'double_down_participants'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.double_down_participants;
  END IF;
END $$;