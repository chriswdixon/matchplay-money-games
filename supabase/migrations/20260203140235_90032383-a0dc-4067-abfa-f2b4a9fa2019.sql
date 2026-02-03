-- Security improvements: Add data retention and cleanup

-- Create a function to cleanup old pin_attempts records (older than 30 days)
CREATE OR REPLACE FUNCTION public.cleanup_old_pin_attempts()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM public.pin_attempts
  WHERE attempted_at < now() - interval '30 days';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- Create a function to cleanup old consent_records data (clear ip_address and user_agent for records older than 90 days)
CREATE OR REPLACE FUNCTION public.cleanup_consent_records_pii()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_count integer;
BEGIN
  UPDATE public.consent_records
  SET ip_address = NULL, user_agent = NULL
  WHERE created_at < now() - interval '90 days'
    AND (ip_address IS NOT NULL OR user_agent IS NOT NULL);
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;

-- Add comment explaining the cleanup functions
COMMENT ON FUNCTION public.cleanup_old_pin_attempts() IS 'Removes PIN attempt records older than 30 days to limit data retention and reduce security logging exposure';
COMMENT ON FUNCTION public.cleanup_consent_records_pii() IS 'Clears IP address and user agent data from consent records older than 90 days to minimize privacy risks';