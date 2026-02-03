-- Add note column to player_ratings table
ALTER TABLE public.player_ratings 
ADD COLUMN note TEXT DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.player_ratings.note IS 'Optional note about the player, only visible to admins';