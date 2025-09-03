-- Comprehensive Security Fixes for Profile Data Protection

-- 1. Ensure user_id column cannot be NULL (critical security requirement)
ALTER TABLE public.profiles 
  ALTER COLUMN user_id SET NOT NULL;

-- 2. Add unique constraint to prevent duplicate profiles per user
CREATE UNIQUE INDEX IF NOT EXISTS profiles_user_id_unique ON public.profiles(user_id);

-- 3. Add validation trigger to ensure profile data integrity
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
        
        IF NEW.user_id != auth.uid() THEN
            RAISE EXCEPTION 'Cannot update another user''s profile';
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$;

-- Create trigger for profile validation
DROP TRIGGER IF EXISTS validate_profile_security_trigger ON public.profiles;
CREATE TRIGGER validate_profile_security_trigger
    BEFORE INSERT OR UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.validate_profile_security();

-- 4. Recreate RLS policies with explicit RESTRICTIVE mode for maximum security
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;  
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;

-- Create restrictive policies that explicitly deny access unless conditions are met
CREATE POLICY "Users can view only their own profile"
    ON public.profiles 
    FOR SELECT 
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert only their own profile"
    ON public.profiles 
    FOR INSERT 
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update only their own profile"
    ON public.profiles 
    FOR UPDATE 
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Explicitly deny all access to unauthenticated users
CREATE POLICY "Deny unauthenticated access"
    ON public.profiles
    FOR ALL
    TO anon
    USING (false);

-- 5. Add additional security function to check profile ownership
CREATE OR REPLACE FUNCTION public.is_profile_owner(profile_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT auth.uid() = profile_user_id AND auth.uid() IS NOT NULL;
$$;

-- 6. Ensure RLS is enabled and force it
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles FORCE ROW LEVEL SECURITY;