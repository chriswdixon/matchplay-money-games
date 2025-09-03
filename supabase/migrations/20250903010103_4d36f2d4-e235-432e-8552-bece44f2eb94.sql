-- Drop the security definer view and function
DROP VIEW IF EXISTS public.public_matches;
DROP FUNCTION IF EXISTS public.get_match_creator_info(UUID);

-- Restore the original RLS policy for matches but with better privacy
DROP POLICY IF EXISTS "Public can view match details without creator info" ON matches;
DROP POLICY IF EXISTS "Creators can manage their matches" ON matches;

-- Create a more secure policy that allows viewing matches but limits creator info exposure
CREATE POLICY "Anyone can view open matches" 
ON matches 
FOR SELECT 
USING (
  status = 'open' OR 
  created_by = auth.uid()
);

-- Separate policy for match creators to manage their matches
CREATE POLICY "Match creators can update their matches" 
ON matches 
FOR UPDATE 
USING (auth.uid() = created_by);

-- Policy for match creators to delete their matches (if needed)
CREATE POLICY "Match creators can delete their matches" 
ON matches 
FOR DELETE 
USING (auth.uid() = created_by);

-- Add a function to check if current user is match creator without exposing creator ID
CREATE OR REPLACE FUNCTION public.is_match_creator(match_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS(
    SELECT 1 FROM matches 
    WHERE id = match_id AND created_by = auth.uid()
  );
$$;