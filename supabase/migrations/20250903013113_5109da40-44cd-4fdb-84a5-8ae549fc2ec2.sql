-- Fix function search path security issue
CREATE OR REPLACE FUNCTION public.log_profile_changes()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public
AS $$
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
$$;