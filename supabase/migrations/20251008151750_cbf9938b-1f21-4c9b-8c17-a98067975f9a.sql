-- Fix Warning 1: Add UPDATE policy for match_participants
-- Allow users to update only their own participation records
CREATE POLICY "Users can update their own participation"
ON public.match_participants
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Fix Warning 2: Replace overly broad ALL policy on match_confirmations
-- First, drop the existing ALL policy
DROP POLICY IF EXISTS "Players can manage their own confirmations" ON public.match_confirmations;

-- Add separate INSERT policy with validation that player is a participant
CREATE POLICY "Players can insert confirmations for their matches"
ON public.match_confirmations
FOR INSERT
WITH CHECK (
  auth.uid() = player_id 
  AND EXISTS (
    SELECT 1 FROM public.match_participants mp 
    WHERE mp.match_id = match_confirmations.match_id 
    AND mp.user_id = auth.uid()
  )
);

-- Add UPDATE policy for own confirmations
CREATE POLICY "Players can update their own confirmations"
ON public.match_confirmations
FOR UPDATE
USING (auth.uid() = player_id)
WITH CHECK (auth.uid() = player_id);

-- Add DELETE policy for own confirmations
CREATE POLICY "Players can delete their own confirmations"
ON public.match_confirmations
FOR DELETE
USING (auth.uid() = player_id);