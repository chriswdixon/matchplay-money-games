-- Move pg_trgm extension from public schema to extensions schema
-- This resolves the Supabase linter warning about extensions in public schema

-- Drop the extension from public schema
DROP EXTENSION IF EXISTS pg_trgm CASCADE;

-- Create the extension in the extensions schema (Supabase best practice)
CREATE EXTENSION IF NOT EXISTS pg_trgm SCHEMA extensions;

-- Grant usage on the extensions schema to public and authenticated roles
GRANT USAGE ON SCHEMA extensions TO public;
GRANT USAGE ON SCHEMA extensions TO authenticated;

-- Comment explaining the change
COMMENT ON EXTENSION pg_trgm IS 'Moved to extensions schema per Supabase security best practices';