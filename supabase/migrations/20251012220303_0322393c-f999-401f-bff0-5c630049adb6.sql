-- Fix 1: Add unique indexes for transaction idempotency
-- Prevent duplicate match buy-in charges using partial unique index
CREATE UNIQUE INDEX unique_match_buyin_idx 
ON account_transactions (match_id, user_id, transaction_type) 
WHERE transaction_type = 'match_buyin';

-- Prevent duplicate match winning credits using partial unique index
CREATE UNIQUE INDEX unique_match_winning_idx 
ON account_transactions (match_id, user_id, transaction_type) 
WHERE transaction_type = 'winning';

-- Fix 2: Add coordinate validation trigger
CREATE OR REPLACE FUNCTION public.validate_coordinates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Validate latitude is between -90 and 90
  IF NEW.latitude IS NOT NULL AND (NEW.latitude < -90 OR NEW.latitude > 90) THEN
    RAISE EXCEPTION 'Latitude must be between -90 and 90';
  END IF;
  
  -- Validate longitude is between -180 and 180
  IF NEW.longitude IS NOT NULL AND (NEW.longitude < -180 OR NEW.longitude > 180) THEN
    RAISE EXCEPTION 'Longitude must be between -180 and 180';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Apply coordinate validation trigger to matches table
CREATE TRIGGER validate_match_coordinates
BEFORE INSERT OR UPDATE ON matches
FOR EACH ROW
EXECUTE FUNCTION public.validate_coordinates();