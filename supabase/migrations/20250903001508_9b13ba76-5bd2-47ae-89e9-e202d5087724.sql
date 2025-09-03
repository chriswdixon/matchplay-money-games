-- CRITICAL SECURITY FIX: Secure match participants table
-- Remove public access to match_participants - this was allowing anyone to track user participation

-- First, drop the existing overly permissive policy
DROP POLICY IF EXISTS "Anyone can view match participants" ON public.match_participants;

-- Create secure policies that only allow relevant users to see participation data
CREATE POLICY "Users can view participants in their own matches" 
ON public.match_participants 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.matches m 
    WHERE m.id = match_participants.match_id 
    AND (m.created_by = auth.uid() OR 
         EXISTS (
           SELECT 1 FROM public.match_participants mp2 
           WHERE mp2.match_id = m.id AND mp2.user_id = auth.uid()
         ))
  )
);

-- CRITICAL SECURITY FIX: Fix database functions search path security
-- Update calculate_distance function to have proper search path
CREATE OR REPLACE FUNCTION public.calculate_distance(
  lat1 DECIMAL(10, 8),
  lon1 DECIMAL(11, 8),
  lat2 DECIMAL(10, 8),
  lon2 DECIMAL(11, 8)
)
RETURNS DECIMAL
LANGUAGE SQL
IMMUTABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (
    6371 * acos(
      cos(radians(lat1)) * 
      cos(radians(lat2)) * 
      cos(radians(lon2) - radians(lon1)) + 
      sin(radians(lat1)) * 
      sin(radians(lat2))
    )
  )::DECIMAL;
$$;

-- Update get_nearby_matches function to have proper search path
CREATE OR REPLACE FUNCTION public.get_nearby_matches(
  user_lat DECIMAL(10, 8),
  user_lon DECIMAL(11, 8),
  radius_km DECIMAL DEFAULT 50
)
RETURNS TABLE (
  id UUID,
  course_name TEXT,
  location TEXT,
  address TEXT,
  scheduled_time TIMESTAMP WITH TIME ZONE,
  format TEXT,
  buy_in_amount INTEGER,
  distance_km DECIMAL
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
    m.address,
    m.scheduled_time,
    m.format,
    m.buy_in_amount,
    public.calculate_distance(user_lat, user_lon, m.latitude, m.longitude) as distance_km
  FROM public.matches m
  WHERE m.status = 'open'
    AND m.latitude IS NOT NULL 
    AND m.longitude IS NOT NULL
    AND public.calculate_distance(user_lat, user_lon, m.latitude, m.longitude) <= radius_km
  ORDER BY distance_km ASC;
$$;