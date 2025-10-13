-- Add additional team PIN columns for larger team matches
ALTER TABLE public.matches 
ADD COLUMN team3_pin text,
ADD COLUMN team4_pin text;

-- Add check constraints for team PINs
ALTER TABLE public.matches 
ADD CONSTRAINT team3_pin_format CHECK (team3_pin IS NULL OR team3_pin ~ '^\d{4}$'),
ADD CONSTRAINT team4_pin_format CHECK (team4_pin IS NULL OR team4_pin ~ '^\d{4}$');

COMMENT ON COLUMN public.matches.team3_pin IS 'Optional 4-digit PIN for Team 3 in team matches (6+ players)';
COMMENT ON COLUMN public.matches.team4_pin IS 'Optional 4-digit PIN for Team 4 in team matches (8 players)';

-- Add column to track which user set each team PIN
ALTER TABLE public.matches
ADD COLUMN team1_pin_creator uuid REFERENCES auth.users(id),
ADD COLUMN team2_pin_creator uuid REFERENCES auth.users(id),
ADD COLUMN team3_pin_creator uuid REFERENCES auth.users(id),
ADD COLUMN team4_pin_creator uuid REFERENCES auth.users(id);

COMMENT ON COLUMN public.matches.team1_pin_creator IS 'User who set Team 1 PIN (usually match creator)';
COMMENT ON COLUMN public.matches.team2_pin_creator IS 'User who set Team 2 PIN (first Team 2 member)';
COMMENT ON COLUMN public.matches.team3_pin_creator IS 'User who set Team 3 PIN (first Team 3 member)';
COMMENT ON COLUMN public.matches.team4_pin_creator IS 'User who set Team 4 PIN (first Team 4 member)';