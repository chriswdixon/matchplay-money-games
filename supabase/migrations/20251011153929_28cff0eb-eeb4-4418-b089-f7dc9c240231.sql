-- Create table to track match cancellation confirmations
CREATE TABLE public.match_cancellation_confirmations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  match_id uuid NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  cancelling_player_id uuid NOT NULL,
  stated_reason text NOT NULL,
  confirming_player_id uuid NOT NULL,
  confirmed boolean NOT NULL DEFAULT false,
  alternate_reason text,
  confirmed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(match_id, cancelling_player_id, confirming_player_id)
);

-- Enable RLS
ALTER TABLE public.match_cancellation_confirmations ENABLE ROW LEVEL SECURITY;

-- Players can view confirmations for matches they participate in
CREATE POLICY "Players can view confirmations for their matches"
ON public.match_cancellation_confirmations
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.match_participants mp
    WHERE mp.match_id = match_cancellation_confirmations.match_id
    AND mp.user_id = auth.uid()
  )
);

-- Players can insert their own confirmations
CREATE POLICY "Players can confirm cancellations"
ON public.match_cancellation_confirmations
FOR INSERT
WITH CHECK (
  auth.uid() = confirming_player_id
  AND EXISTS (
    SELECT 1 FROM public.match_participants mp
    WHERE mp.match_id = match_cancellation_confirmations.match_id
    AND mp.user_id = auth.uid()
  )
);

-- Players can update their own confirmations
CREATE POLICY "Players can update their confirmations"
ON public.match_cancellation_confirmations
FOR UPDATE
USING (auth.uid() = confirming_player_id);

-- Enable realtime for this table
ALTER TABLE public.match_cancellation_confirmations REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.match_cancellation_confirmations;