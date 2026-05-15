CREATE OR REPLACE FUNCTION public.validate_profile_security()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public
AS $$
BEGIN
    -- Prevent creating profiles for other users during INSERT
    IF TG_OP = 'INSERT' THEN
        IF NEW.user_id != auth.uid() THEN
            RAISE EXCEPTION 'Cannot create profile for another user';
        END IF;
    END IF;
    
    -- Prevent changing user_id during UPDATE
    IF TG_OP = 'UPDATE' THEN
        IF OLD.user_id != NEW.user_id THEN
            RAISE EXCEPTION 'Cannot change profile user_id';
        END IF;

        -- Allow system-managed rating recalculation triggered by player_ratings.
        -- Only average_rating and automatic updated_at metadata may change in this path.
        IF NEW.user_id != auth.uid()
           AND (to_jsonb(NEW) - 'average_rating' - 'updated_at') IS NOT DISTINCT FROM (to_jsonb(OLD) - 'average_rating' - 'updated_at')
        THEN
            RETURN NEW;
        END IF;
        
        IF NEW.user_id != auth.uid() THEN
            RAISE EXCEPTION 'Cannot update another user''s profile';
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$;