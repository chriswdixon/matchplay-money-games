-- Add PIN columns to matches table
ALTER TABLE public.matches 
ADD COLUMN pin text,
ADD COLUMN team2_pin text;

-- Add check constraint to ensure PINs are exactly 4 digits if provided
ALTER TABLE public.matches 
ADD CONSTRAINT pin_format CHECK (pin IS NULL OR pin ~ '^\d{4}$'),
ADD CONSTRAINT team2_pin_format CHECK (team2_pin IS NULL OR team2_pin ~ '^\d{4}$');

COMMENT ON COLUMN public.matches.pin IS 'Optional 4-digit PIN for match access control. For team matches, this is Team 1 PIN';
COMMENT ON COLUMN public.matches.team2_pin IS 'Optional 4-digit PIN for Team 2 in team matches';