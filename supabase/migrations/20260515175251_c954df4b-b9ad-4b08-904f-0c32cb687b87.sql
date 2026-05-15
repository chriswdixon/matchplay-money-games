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
        -- This preserves profile ownership checks while permitting the review workflow
        -- to update only average_rating (and automatic updated_at metadata).
        IF NEW.user_id != auth.uid()
           AND NEW.display_name IS NOT DISTINCT FROM OLD.display_name
           AND NEW.handicap IS NOT DISTINCT FROM OLD.handicap
           AND NEW.profile_picture_url IS NOT DISTINCT FROM OLD.profile_picture_url
           AND NEW.created_at IS NOT DISTINCT FROM OLD.created_at
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