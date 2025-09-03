-- Fix infinite recursion in match_participants RLS policies

-- Drop the problematic SELECT policy that causes recursion
DROP POLICY IF EXISTS "Users can view participants in their own matches" ON match_participants;

-- Create a simpler SELECT policy that doesn't cause recursion
CREATE POLICY "Users can view match participants" 
ON match_participants 
FOR SELECT 
USING (
  -- Users can see participants if they are the match creator OR if they are a participant
  EXISTS (
    SELECT 1 FROM matches m 
    WHERE m.id = match_participants.match_id 
    AND m.created_by = auth.uid()
  )
  OR user_id = auth.uid()
);

-- Ensure the DELETE policy is simple and doesn't cause recursion
DROP POLICY IF EXISTS "Users can leave matches they joined" ON match_participants;

CREATE POLICY "Users can leave matches they joined" 
ON match_participants 
FOR DELETE 
USING (auth.uid() = user_id);