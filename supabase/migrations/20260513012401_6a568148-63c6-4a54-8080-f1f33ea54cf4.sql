INSERT INTO public.private_profile_data (user_id, membership_tier)
SELECT ur.user_id, 'Local Player'
FROM public.user_roles ur
WHERE ur.role = 'admin'
ON CONFLICT (user_id) DO UPDATE SET membership_tier = EXCLUDED.membership_tier, updated_at = now();