-- Add tee_data JSONB column to matches table for storing rich course/tee information
-- Structure: { tee_name, slope_rating, course_rating, total_yardage, holes: { "1": { par, yardage }, ... } }
ALTER TABLE public.matches
ADD COLUMN tee_data jsonb NULL;