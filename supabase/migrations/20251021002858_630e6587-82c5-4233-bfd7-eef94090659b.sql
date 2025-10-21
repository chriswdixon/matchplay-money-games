-- Grant admin role to current user
-- This will allow updating social links and accessing admin features

-- First, get the current user's ID and insert admin role
INSERT INTO public.user_roles (user_id, role)
SELECT auth.uid(), 'admin'
WHERE auth.uid() IS NOT NULL
ON CONFLICT (user_id, role) DO NOTHING;

-- Verify the role was added
SELECT user_id, role, created_at 
FROM public.user_roles 
WHERE user_id = auth.uid();