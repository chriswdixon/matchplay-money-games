-- Add date_of_birth to private_profile_data table
ALTER TABLE public.private_profile_data 
ADD COLUMN date_of_birth date;

-- Add validation trigger to ensure date_of_birth is not in the future
CREATE OR REPLACE FUNCTION public.validate_date_of_birth()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.date_of_birth IS NOT NULL AND NEW.date_of_birth > CURRENT_DATE THEN
    RAISE EXCEPTION 'Date of birth cannot be in the future';
  END IF;
  
  IF NEW.date_of_birth IS NOT NULL AND NEW.date_of_birth < (CURRENT_DATE - INTERVAL '120 years') THEN
    RAISE EXCEPTION 'Invalid date of birth';
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_dob_trigger
BEFORE INSERT OR UPDATE ON public.private_profile_data
FOR EACH ROW
EXECUTE FUNCTION public.validate_date_of_birth();