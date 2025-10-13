-- Create invites table
CREATE TABLE public.invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  used_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  used_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Enable RLS
ALTER TABLE public.invites ENABLE ROW LEVEL SECURITY;

-- Admins can view all invites
CREATE POLICY "Admins can view all invites"
ON public.invites
FOR SELECT
USING (has_role(auth.uid(), 'admin'));

-- Admins can create invites
CREATE POLICY "Admins can create invites"
ON public.invites
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin') AND auth.uid() = created_by);

-- Function to validate and consume invite code
CREATE OR REPLACE FUNCTION public.validate_and_consume_invite(
  p_code TEXT,
  p_email TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite RECORD;
BEGIN
  -- Check if email is from @match-play.co domain (no invite needed)
  IF p_email LIKE '%@match-play.co' THEN
    RETURN jsonb_build_object('valid', true, 'bypass', true);
  END IF;

  -- Find the invite
  SELECT * INTO v_invite
  FROM public.invites
  WHERE code = p_code
  FOR UPDATE;

  -- Check if invite exists
  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Invalid invite code');
  END IF;

  -- Check if already used
  IF v_invite.used_by IS NOT NULL THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Invite code already used');
  END IF;

  -- Check if expired
  IF v_invite.expires_at < now() THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Invite code expired');
  END IF;

  -- Mark as used (will be updated with actual user_id after signup)
  UPDATE public.invites
  SET used_at = now()
  WHERE id = v_invite.id;

  RETURN jsonb_build_object('valid', true, 'invite_id', v_invite.id);
END;
$$;

-- Function to link invite to user after signup
CREATE OR REPLACE FUNCTION public.link_invite_to_user(
  p_code TEXT,
  p_user_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.invites
  SET used_by = p_user_id
  WHERE code = p_code AND used_at IS NOT NULL AND used_by IS NULL;
END;
$$;