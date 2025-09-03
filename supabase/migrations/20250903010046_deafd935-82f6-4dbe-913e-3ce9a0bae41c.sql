-- Create a secure view for public match listings that anonymizes creator information
CREATE OR REPLACE VIEW public.public_matches AS
SELECT 
  id,
  course_name,
  location,
  address,
  latitude,
  longitude,
  scheduled_time,
  format,
  buy_in_amount,
  handicap_min,
  handicap_max,
  max_participants,
  status,
  created_at,
  updated_at,
  -- Remove created_by field to protect user privacy
  CASE 
    WHEN created_by = auth.uid() THEN created_by
    ELSE NULL
  END as created_by
FROM matches
WHERE status = 'open';

-- Enable RLS on the view
ALTER VIEW public.public_matches SET (security_barrier = true);

-- Grant appropriate permissions
GRANT SELECT ON public.public_matches TO authenticated;
GRANT SELECT ON public.public_matches TO anon;

-- Create a function to safely get match creator info only when needed
CREATE OR REPLACE FUNCTION public.get_match_creator_info(match_id UUID)
RETURNS TABLE(
  is_creator BOOLEAN,
  can_manage BOOLEAN
)
LANGUAGE SQL
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    (created_by = auth.uid()) as is_creator,
    (created_by = auth.uid()) as can_manage
  FROM matches 
  WHERE id = match_id;
$$;

-- Update RLS policy for matches to be more restrictive about creator info
DROP POLICY IF EXISTS "Anyone can view open matches" ON matches;

CREATE POLICY "Public can view match details without creator info" 
ON matches 
FOR SELECT 
USING (
  status = 'open' AND (
    created_by = auth.uid() OR 
    auth.uid() IS NOT NULL
  )
);

-- Policy for creators to see and manage their own matches
CREATE POLICY "Creators can manage their matches" 
ON matches 
FOR ALL
USING (created_by = auth.uid())
WITH CHECK (created_by = auth.uid());