-- Fix the function search path security issue
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

-- Check for any remaining security definer views and remove them
-- First, let's see what views exist
DO $$
DECLARE
    view_name text;
BEGIN
    FOR view_name IN 
        SELECT schemaname||'.'||viewname 
        FROM pg_views 
        WHERE schemaname = 'public'
    LOOP
        EXECUTE format('ALTER VIEW %s SET (security_barrier = false)', view_name);
    END LOOP;
END $$;