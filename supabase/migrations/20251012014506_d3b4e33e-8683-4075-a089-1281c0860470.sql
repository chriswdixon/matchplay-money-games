-- Fix 1: Update match score validation to realistic golf scoring limits (1-10)
-- This prevents users from bypassing frontend validation and submitting impossible scores

DROP FUNCTION IF EXISTS public.validate_match_score_strokes() CASCADE;

CREATE OR REPLACE FUNCTION public.validate_match_score_strokes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Validate strokes are within realistic golf scoring range (1-10)
  -- Most golf courses consider 10 as the maximum reasonable score per hole
  IF NEW.strokes IS NOT NULL AND (NEW.strokes < 1 OR NEW.strokes > 10) THEN
    RAISE EXCEPTION 'Strokes must be between 1 and 10';
  END IF;
  
  -- Validate hole number is between 1 and 18
  IF NEW.hole_number < 1 OR NEW.hole_number > 18 THEN
    RAISE EXCEPTION 'Hole number must be between 1 and 18';
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Recreate the trigger
CREATE TRIGGER validate_match_score_strokes_trigger
  BEFORE INSERT OR UPDATE ON public.match_scores
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_match_score_strokes();

-- Fix 2: Update matches RLS policy to prevent exposure of started/completed match details
-- Only participants and creators should see full match details regardless of status

DROP POLICY IF EXISTS "Public can view matches with location restrictions" ON public.matches;

CREATE POLICY "Users can view matches they participate in or open matches"
ON public.matches
FOR SELECT
USING (
  -- Allow viewing open matches (for discovery)
  status = 'open' OR 
  -- Allow creators to see their matches
  created_by = auth.uid() OR
  -- Allow participants to see matches they joined
  EXISTS (
    SELECT 1 
    FROM public.match_participants mp 
    WHERE mp.match_id = matches.id 
    AND mp.user_id = auth.uid()
  )
);