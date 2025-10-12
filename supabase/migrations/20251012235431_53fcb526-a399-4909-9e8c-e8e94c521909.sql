-- Add holes column to matches table
ALTER TABLE matches
ADD COLUMN holes integer NOT NULL DEFAULT 18;

-- Add check constraint to ensure holes is either 9 or 18
ALTER TABLE matches
ADD CONSTRAINT matches_holes_check CHECK (holes IN (9, 18));

-- Add comment to document the column
COMMENT ON COLUMN matches.holes IS 'Number of holes to be played in the match (9 or 18). 9-hole matches must be scheduled at or after 6 PM.';