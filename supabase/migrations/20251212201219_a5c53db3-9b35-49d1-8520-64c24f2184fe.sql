-- Create age verification tokens table
CREATE TABLE public.age_verification_tokens (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  token text NOT NULL UNIQUE,
  email text NOT NULL,
  verified boolean NOT NULL DEFAULT false,
  verified_at timestamp with time zone,
  expires_at timestamp with time zone NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.age_verification_tokens ENABLE ROW LEVEL SECURITY;

-- Users can view their own tokens
CREATE POLICY "Users can view their own age verification tokens"
ON public.age_verification_tokens
FOR SELECT
USING (user_id = auth.uid());

-- Service role can manage tokens
CREATE POLICY "Service role can manage age verification tokens"
ON public.age_verification_tokens
FOR ALL
USING (true)
WITH CHECK (true);

-- Create index for token lookup
CREATE INDEX idx_age_verification_tokens_token ON public.age_verification_tokens(token);
CREATE INDEX idx_age_verification_tokens_user ON public.age_verification_tokens(user_id);

-- Add age_verified column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS age_verified boolean NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS age_verified_at timestamp with time zone;