-- Update all 'local' tier users to 'Free'
UPDATE public.private_profile_data
SET membership_tier = 'Free'
WHERE LOWER(membership_tier) = 'local';

-- Change default value for new signups to 'Free'
ALTER TABLE public.private_profile_data 
ALTER COLUMN membership_tier SET DEFAULT 'Free';