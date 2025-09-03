-- Critical Security Fixes: Location Data Protection and Sensitive Data Separation

-- 1. Create private profile data table for sensitive information
CREATE TABLE public.private_profile_data (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  phone TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on private profile data
ALTER TABLE public.private_profile_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.private_profile_data FORCE ROW LEVEL SECURITY;

-- Create RLS policies for private profile data
CREATE POLICY "Users can view only their own private data"
    ON public.private_profile_data 
    FOR SELECT 
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert only their own private data"
    ON public.private_profile_data 
    FOR INSERT 
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update only their own private data"
    ON public.private_profile_data 
    FOR UPDATE 
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Deny unauthenticated access to private data"
    ON public.private_profile_data
    FOR ALL
    TO anon
    USING (false);

-- Create trigger for automatic timestamp updates on private profile data
CREATE TRIGGER update_private_profile_data_updated_at
    BEFORE UPDATE ON public.private_profile_data
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Migrate existing phone data to private table
INSERT INTO public.private_profile_data (user_id, phone)
SELECT user_id, phone 
FROM public.profiles 
WHERE phone IS NOT NULL;

-- Remove phone column from profiles table (sensitive data separation)
ALTER TABLE public.profiles DROP COLUMN IF EXISTS phone;

-- 3. Fix Match Location Data Exposure - Restrict precise coordinates to participants only
DROP POLICY IF EXISTS "Public can view match details without creator info" ON public.matches;

-- Create separate policies for different levels of match data access
CREATE POLICY "Public can view basic match info"
    ON public.matches 
    FOR SELECT 
    TO authenticated
    USING (
        status = 'open' 
        AND auth.uid() IS NOT NULL
    );

-- Create function to check if user is match participant
CREATE OR REPLACE FUNCTION public.is_match_participant(match_id UUID, user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS(
        SELECT 1 FROM public.match_participants 
        WHERE match_participants.match_id = is_match_participant.match_id 
        AND match_participants.user_id = is_match_participant.user_id
    );
$$;

-- Create view for public match data (without precise location)
CREATE OR REPLACE VIEW public.public_matches AS
SELECT 
    id,
    course_name,
    location, -- General location name only
    scheduled_time,
    format,
    buy_in_amount,
    max_participants,
    handicap_min,
    handicap_max,
    status,
    created_at,
    updated_at,
    -- Only show precise coordinates and address to participants and creators
    CASE 
        WHEN (created_by = auth.uid() OR public.is_match_participant(id, auth.uid()))
        THEN latitude 
        ELSE NULL 
    END as latitude,
    CASE 
        WHEN (created_by = auth.uid() OR public.is_match_participant(id, auth.uid()))
        THEN longitude 
        ELSE NULL 
    END as longitude,
    CASE 
        WHEN (created_by = auth.uid() OR public.is_match_participant(id, auth.uid()))
        THEN address 
        ELSE NULL 
    END as address,
    -- Always show if user is creator for management purposes
    (created_by = auth.uid()) as is_creator
FROM public.matches
WHERE status = 'open' AND auth.uid() IS NOT NULL;

-- Grant access to the public matches view
GRANT SELECT ON public.public_matches TO authenticated;

-- 4. Add input validation function for user data
CREATE OR REPLACE FUNCTION public.sanitize_text_input(input_text TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF input_text IS NULL THEN
        RETURN NULL;
    END IF;
    
    -- Basic XSS prevention: remove common malicious patterns
    -- Strip HTML tags and common script patterns
    RETURN regexp_replace(
        regexp_replace(
            regexp_replace(input_text, '<[^>]*>', '', 'g'),
            'javascript:', '', 'gi'
        ),
        'on\w+\s*=', '', 'gi'
    );
END;
$$;