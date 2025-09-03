-- Add additional security constraints to profiles table
-- Ensure user_id cannot be null (prevents orphaned profiles)
ALTER TABLE public.profiles ALTER COLUMN user_id SET NOT NULL;

-- Add a check to ensure profiles can only be created for existing auth users
-- This is already handled by the foreign key, but let's make it explicit

-- Add audit trail for profile changes (optional security enhancement)
CREATE TABLE IF NOT EXISTS public.profile_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    action TEXT NOT NULL,
    old_data JSONB,
    new_data JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on audit log
ALTER TABLE public.profile_audit_log ENABLE ROW LEVEL SECURITY;

-- Only allow users to view their own audit logs
CREATE POLICY "Users can view their own profile audit logs" ON public.profile_audit_log
FOR SELECT USING (user_id = auth.uid());

-- Function to log profile changes
CREATE OR REPLACE FUNCTION public.log_profile_changes()
RETURNS TRIGGER AS $$
BEGIN
    -- Log updates
    IF TG_OP = 'UPDATE' THEN
        INSERT INTO public.profile_audit_log (profile_id, user_id, action, old_data, new_data)
        VALUES (NEW.id, NEW.user_id, 'UPDATE', to_jsonb(OLD), to_jsonb(NEW));
        RETURN NEW;
    END IF;
    
    -- Log deletes
    IF TG_OP = 'DELETE' THEN
        INSERT INTO public.profile_audit_log (profile_id, user_id, action, old_data)
        VALUES (OLD.id, OLD.user_id, 'DELETE', to_jsonb(OLD));
        RETURN OLD;
    END IF;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for profile audit logging
DROP TRIGGER IF EXISTS profile_audit_trigger ON public.profiles;
CREATE TRIGGER profile_audit_trigger
    AFTER UPDATE OR DELETE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.log_profile_changes();