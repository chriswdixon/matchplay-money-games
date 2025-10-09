-- Create role enum for proper role management
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

-- Create user_roles table (CRITICAL: roles must be in separate table to prevent privilege escalation)
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles (prevents recursive RLS issues)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- RLS policies for user_roles table
CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles"
ON public.user_roles
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage roles"
ON public.user_roles
FOR ALL
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Drop the problematic policies on private_profile_data
DROP POLICY IF EXISTS "Deny unauthenticated access to private data" ON public.private_profile_data;
DROP POLICY IF EXISTS "Users can view only their own private data" ON public.private_profile_data;

-- Create secure policies for private_profile_data
CREATE POLICY "Users can view only their own private data"
ON public.private_profile_data
FOR SELECT
USING (
  auth.uid() = user_id 
  OR public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Only admins can view all private data"
ON public.private_profile_data
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- Keep existing insert/update policies but ensure they're secure
DROP POLICY IF EXISTS "Users can insert only their own private data" ON public.private_profile_data;
DROP POLICY IF EXISTS "Users can update only their own private data" ON public.private_profile_data;

CREATE POLICY "Users can insert only their own private data"
ON public.private_profile_data
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update only their own private data"
ON public.private_profile_data
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Create security definer function to get user emails (only for admins)
CREATE OR REPLACE FUNCTION public.get_user_email(_user_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_email text;
BEGIN
  -- Only allow admins to fetch emails
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Access denied: Only admins can access user emails';
  END IF;
  
  -- Fetch email from auth.users
  SELECT email INTO user_email
  FROM auth.users
  WHERE id = _user_id;
  
  RETURN user_email;
END;
$$;

-- Create function to get user private data (admin only)
CREATE OR REPLACE FUNCTION public.get_user_private_data(_user_id uuid)
RETURNS TABLE(
  id uuid,
  user_id uuid,
  phone text,
  membership_tier text,
  email text,
  created_at timestamp with time zone,
  updated_at timestamp with time zone
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only allow admins to fetch private data
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Access denied: Only admins can access user private data';
  END IF;
  
  RETURN QUERY
  SELECT 
    ppd.id,
    ppd.user_id,
    ppd.phone,
    ppd.membership_tier,
    au.email,
    ppd.created_at,
    ppd.updated_at
  FROM public.private_profile_data ppd
  LEFT JOIN auth.users au ON au.id = ppd.user_id
  WHERE ppd.user_id = _user_id;
END;
$$;