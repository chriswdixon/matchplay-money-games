-- Fix Security Definer View Issue - Remove problematic view and use proper RLS policies

-- 1. Remove the problematic security definer view
DROP VIEW IF EXISTS public.public_matches;

-- 2. Create proper RLS policies for location data protection without security definer views
DROP POLICY IF EXISTS "Public can view basic match info" ON public.matches;

-- Recreate the original policy but with location data restrictions built into the select
CREATE POLICY "Public can view match details with location restrictions"
    ON public.matches 
    FOR SELECT 
    TO authenticated
    USING (
        status = 'open' 
        AND auth.uid() IS NOT NULL
    );

-- 3. Create a secure function to get match data with proper location filtering
CREATE OR REPLACE FUNCTION public.get_match_with_location_filter(match_id UUID)
RETURNS TABLE(
    id UUID,
    course_name TEXT,
    location TEXT,
    scheduled_time TIMESTAMP WITH TIME ZONE,
    format TEXT,
    buy_in_amount INTEGER,
    max_participants INTEGER,
    handicap_min INTEGER,
    handicap_max INTEGER,
    status TEXT,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE,
    latitude NUMERIC,
    longitude NUMERIC,
    address TEXT,
    is_creator BOOLEAN,
    is_participant BOOLEAN
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT 
        m.id,
        m.course_name,
        m.location,
        m.scheduled_time,
        m.format,
        m.buy_in_amount,
        m.max_participants,
        m.handicap_min,
        m.handicap_max,
        m.status,
        m.created_at,
        m.updated_at,
        -- Only show precise coordinates and address to participants and creators
        CASE 
            WHEN (m.created_by = auth.uid() OR public.is_match_participant(m.id, auth.uid()))
            THEN m.latitude 
            ELSE NULL 
        END as latitude,
        CASE 
            WHEN (m.created_by = auth.uid() OR public.is_match_participant(m.id, auth.uid()))
            THEN m.longitude 
            ELSE NULL 
        END as longitude,
        CASE 
            WHEN (m.created_by = auth.uid() OR public.is_match_participant(m.id, auth.uid()))
            THEN m.address 
            ELSE NULL 
        END as address,
        (m.created_by = auth.uid()) as is_creator,
        public.is_match_participant(m.id, auth.uid()) as is_participant
    FROM public.matches m
    WHERE m.id = match_id AND m.status = 'open' AND auth.uid() IS NOT NULL;
$$;

-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION public.get_match_with_location_filter(UUID) TO authenticated;