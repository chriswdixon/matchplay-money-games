-- Move membership_tier from profiles to private_profile_data
-- This treats membership levels with the same privacy as phone numbers

-- Add membership_tier column to private_profile_data
ALTER TABLE public.private_profile_data 
ADD COLUMN membership_tier TEXT DEFAULT 'local';

-- Migrate existing membership_tier data
UPDATE public.private_profile_data ppd
SET membership_tier = p.membership_tier
FROM public.profiles p
WHERE ppd.user_id = p.user_id;

-- Remove membership_tier from profiles table
ALTER TABLE public.profiles 
DROP COLUMN membership_tier;