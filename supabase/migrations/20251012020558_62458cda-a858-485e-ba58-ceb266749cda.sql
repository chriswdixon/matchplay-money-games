-- Fix infinite recursion in RLS policies by using security definer functions

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Users can view matches they participate in or open matches" ON public.matches;
DROP POLICY IF EXISTS "Users can view match participants" ON public.match_participants;

-- Create security definer function to check if user is match participant (bypasses RLS)
CREATE OR REPLACE FUNCTION public.is_user_match_participant(p_match_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.match_participants 
    WHERE match_id = p_match_id 
    AND user_id = p_user_id
  );
$$;

-- Create security definer function to check if user created match (bypasses RLS)
CREATE OR REPLACE FUNCTION public.is_user_match_creator(p_match_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.matches 
    WHERE id = p_match_id 
    AND created_by = p_user_id
  );
$$;

-- Recreate matches SELECT policy using security definer function
CREATE POLICY "Users can view matches they participate in or open matches"
ON public.matches
FOR SELECT
TO authenticated
USING (
  status = 'open'::text 
  OR created_by = auth.uid() 
  OR public.is_user_match_participant(id, auth.uid())
);

-- Recreate match_participants SELECT policy using security definer function
CREATE POLICY "Users can view match participants"
ON public.match_participants
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid() 
  OR public.is_user_match_creator(match_id, auth.uid())
);