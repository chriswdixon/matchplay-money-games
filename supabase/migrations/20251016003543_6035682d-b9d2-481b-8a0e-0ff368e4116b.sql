-- Update chriswdixon@gmail.com to tournament subscription tier
UPDATE private_profile_data 
SET membership_tier = 'tournament', updated_at = now()
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'chriswdixon@gmail.com');

-- Add admin role for riley.davis@match-play.co
INSERT INTO user_roles (user_id, role)
SELECT id, 'admin'::app_role
FROM auth.users 
WHERE email = 'riley.davis@match-play.co'
ON CONFLICT (user_id, role) DO NOTHING;

-- Add admin role for joey.blackledge@match-play.co
INSERT INTO user_roles (user_id, role)
SELECT id, 'admin'::app_role
FROM auth.users 
WHERE email = 'joey.blackledge@match-play.co'
ON CONFLICT (user_id, role) DO NOTHING;