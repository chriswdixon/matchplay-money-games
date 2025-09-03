-- Drop the public_matches view that's causing security issues
DROP VIEW IF EXISTS public.public_matches CASCADE;

-- Ensure we're using proper RLS policies on the matches table instead
-- The existing RLS policies should handle security properly without views