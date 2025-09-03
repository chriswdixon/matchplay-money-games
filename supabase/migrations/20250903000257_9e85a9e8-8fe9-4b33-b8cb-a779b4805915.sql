-- Add GPS coordinates to matches table
ALTER TABLE public.matches 
ADD COLUMN latitude DECIMAL(10, 8),
ADD COLUMN longitude DECIMAL(11, 8),
ADD COLUMN address TEXT;

-- Create function to calculate distance between two points using Haversine formula
CREATE OR REPLACE FUNCTION public.calculate_distance(
  lat1 DECIMAL(10, 8),
  lon1 DECIMAL(11, 8),
  lat2 DECIMAL(10, 8),
  lon2 DECIMAL(11, 8)
)
RETURNS DECIMAL
LANGUAGE SQL
IMMUTABLE
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

-- Create function to get nearby matches within a certain radius (in km)
CREATE OR REPLACE FUNCTION public.get_nearby_matches(
  user_lat DECIMAL(10, 8),
  user_lon DECIMAL(11, 8),
  radius_km DECIMAL DEFAULT 50
)
RETURNS TABLE (
  id UUID,
  created_by UUID,
  course_name TEXT,
  location TEXT,
  address TEXT,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  scheduled_time TIMESTAMP WITH TIME ZONE,
  format TEXT,
  buy_in_amount INTEGER,
  handicap_min INTEGER,
  handicap_max INTEGER,
  max_participants INTEGER,
  status TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE,
  distance_km DECIMAL
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    m.*,
    public.calculate_distance(user_lat, user_lon, m.latitude, m.longitude) as distance_km
  FROM public.matches m
  WHERE m.status = 'open'
    AND m.latitude IS NOT NULL 
    AND m.longitude IS NOT NULL
    AND public.calculate_distance(user_lat, user_lon, m.latitude, m.longitude) <= radius_km
  ORDER BY distance_km ASC;
$$;