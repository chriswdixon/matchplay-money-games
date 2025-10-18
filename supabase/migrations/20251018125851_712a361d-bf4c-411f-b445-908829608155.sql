-- Fix RLS policy performance issue on match_participants table
-- Wrap current_setting() in subquery to improve query planning

DROP POLICY IF EXISTS "Users can join matches via secure function" ON public.match_participants;

CREATE POLICY "Users can join matches via secure function"
ON public.match_participants
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM matches m
    WHERE m.id = match_participants.match_id 
      AND (
        m.created_by = (SELECT auth.uid()) 
        OR (SELECT current_setting('app.secure_join_allowed', true)) = 'true'
      )
  )
);