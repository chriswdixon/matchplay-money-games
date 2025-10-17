-- Update user 19a51ba2-1b49-475d-82f4-29c7b4d1b190 to Free tier
UPDATE private_profile_data 
SET membership_tier = 'Free', updated_at = now() 
WHERE user_id = '19a51ba2-1b49-475d-82f4-29c7b4d1b190';