-- Remove admin role from chriswdixon@gmail.com
DELETE FROM public.user_roles
WHERE user_id IN (
  SELECT id FROM auth.users WHERE email = 'chriswdixon@gmail.com'
)
AND role = 'admin';