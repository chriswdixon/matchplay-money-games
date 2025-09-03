-- Check current policies and drop/recreate them properly
DROP POLICY IF EXISTS "Match creators can update their matches" ON matches;
DROP POLICY IF EXISTS "Match creators can delete their matches" ON matches;

-- Create the update policy (it seems this already existed)
-- Separate policy for match creators to delete their matches
CREATE POLICY "Match creators can delete their matches" 
ON matches 
FOR DELETE 
USING (auth.uid() = created_by);

-- Add a simple function to check if current user is match creator without exposing creator ID
CREATE OR REPLACE FUNCTION public.is_match_creator(match_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
AS $$
  SELECT EXISTS(
    SELECT 1 FROM matches 
    WHERE id = match_id AND created_by = auth.uid()
  );
$$;