-- Fix duplicate SELECT policy on matches table
-- Drop the old policy that wasn't removed in the previous migration

DROP POLICY IF EXISTS "Users can view matches they participate in or open matches" ON public.matches;