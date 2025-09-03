-- Check and fix any views with security_barrier set to true
SELECT schemaname, viewname, definition
FROM pg_views 
WHERE schemaname = 'public';

-- Remove security barrier from all views in public schema
DO $$
DECLARE
    rec record;
BEGIN
    -- Get all views in public schema
    FOR rec IN 
        SELECT schemaname, viewname 
        FROM pg_views 
        WHERE schemaname = 'public'
    LOOP
        BEGIN
            EXECUTE format('ALTER VIEW %I.%I SET (security_barrier = false)', rec.schemaname, rec.viewname);
        EXCEPTION 
            WHEN OTHERS THEN
                -- Continue if view doesn't exist or can't be modified
                CONTINUE;
        END;
    END LOOP;
END $$;