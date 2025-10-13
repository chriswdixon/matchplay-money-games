-- Create table for secure match join tokens
CREATE TABLE IF NOT EXISTS public.match_join_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT NOT NULL UNIQUE,
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  team_number INTEGER NOT NULL,
  created_by UUID NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used_at TIMESTAMP WITH TIME ZONE,
  used_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT match_join_tokens_team_number_check CHECK (team_number >= 1 AND team_number <= 4)
);

-- Enable RLS
ALTER TABLE public.match_join_tokens ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view tokens they created
CREATE POLICY "Users can view tokens they created"
ON public.match_join_tokens FOR SELECT
USING (created_by = auth.uid());

-- Policy: Match participants can view tokens for their match
CREATE POLICY "Match participants can view tokens"
ON public.match_join_tokens FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.match_participants mp
    WHERE mp.match_id = match_join_tokens.match_id 
    AND mp.user_id = auth.uid()
  )
);

-- Policy: Service role can insert tokens (via RPC)
CREATE POLICY "Service role can insert tokens"
ON public.match_join_tokens FOR INSERT
WITH CHECK (true);

-- Policy: Service role can update tokens (mark as used)
CREATE POLICY "Service role can update tokens"
ON public.match_join_tokens FOR UPDATE
USING (true);

-- Function to create a secure join token
CREATE OR REPLACE FUNCTION public.create_match_join_token(
  p_match_id UUID,
  p_team_number INTEGER,
  p_expires_in_seconds INTEGER DEFAULT 86400
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token TEXT;
  v_match_exists BOOLEAN;
  v_is_participant BOOLEAN;
BEGIN
  -- Verify user is authenticated
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Verify match exists
  SELECT EXISTS(SELECT 1 FROM public.matches WHERE id = p_match_id) INTO v_match_exists;
  IF NOT v_match_exists THEN
    RAISE EXCEPTION 'Match not found';
  END IF;

  -- Verify user is a participant in the match
  SELECT EXISTS(
    SELECT 1 FROM public.match_participants 
    WHERE match_id = p_match_id AND user_id = auth.uid()
  ) INTO v_is_participant;
  
  IF NOT v_is_participant THEN
    RAISE EXCEPTION 'Only match participants can create join tokens';
  END IF;

  -- Generate secure random token (32 characters)
  v_token := encode(gen_random_bytes(24), 'base64');
  v_token := replace(replace(replace(v_token, '/', '_'), '+', '-'), '=', '');

  -- Insert token
  INSERT INTO public.match_join_tokens (
    token,
    match_id,
    team_number,
    created_by,
    expires_at
  ) VALUES (
    v_token,
    p_match_id,
    p_team_number,
    auth.uid(),
    now() + (p_expires_in_seconds || ' seconds')::INTERVAL
  );

  RETURN v_token;
END;
$$;

-- Function to validate and consume a join token
CREATE OR REPLACE FUNCTION public.validate_match_join_token(
  p_token TEXT
)
RETURNS TABLE(
  match_id UUID,
  team_number INTEGER,
  pin TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token_record RECORD;
  v_required_pin TEXT;
BEGIN
  -- Verify user is authenticated
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Find token
  SELECT * INTO v_token_record
  FROM public.match_join_tokens
  WHERE token = p_token
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid token';
  END IF;

  -- Check if expired
  IF v_token_record.expires_at < now() THEN
    RAISE EXCEPTION 'Token has expired';
  END IF;

  -- Check if already used
  IF v_token_record.used_at IS NOT NULL THEN
    RAISE EXCEPTION 'Token has already been used';
  END IF;

  -- Mark token as used
  UPDATE public.match_join_tokens
  SET used_at = now(), used_by = auth.uid()
  WHERE token = p_token;

  -- Get the PIN for this team
  SELECT 
    CASE v_token_record.team_number
      WHEN 1 THEN m.pin
      WHEN 2 THEN m.team2_pin
      WHEN 3 THEN m.team3_pin
      WHEN 4 THEN m.team4_pin
    END INTO v_required_pin
  FROM public.matches m
  WHERE m.id = v_token_record.match_id;

  -- Return match details and PIN
  RETURN QUERY
  SELECT 
    v_token_record.match_id,
    v_token_record.team_number,
    v_required_pin;
END;
$$;

-- Create index for faster token lookups
CREATE INDEX idx_match_join_tokens_token ON public.match_join_tokens(token);
CREATE INDEX idx_match_join_tokens_expires ON public.match_join_tokens(expires_at);

-- Clean up expired tokens (optional maintenance)
CREATE OR REPLACE FUNCTION public.cleanup_expired_join_tokens()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted_count INTEGER;
BEGIN
  DELETE FROM public.match_join_tokens
  WHERE expires_at < now() - INTERVAL '7 days';
  
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  RETURN v_deleted_count;
END;
$$;