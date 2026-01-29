-- Fix 1: Restrict profile visibility to only ACTIVE matches (not completed/cancelled)
-- This prevents indefinite exposure of personal data after matches end

DROP POLICY IF EXISTS "Users can view relevant profiles" ON profiles;

CREATE POLICY "Users can view relevant profiles"
ON profiles FOR SELECT
USING (
  -- Users can always view their own profile
  (user_id = auth.uid())
  OR
  -- Users can view profiles of participants in their ACTIVE matches only
  (EXISTS (
    SELECT 1 
    FROM match_participants mp1
    JOIN match_participants mp2 ON mp1.match_id = mp2.match_id
    JOIN matches m ON m.id = mp1.match_id
    WHERE mp1.user_id = auth.uid() 
      AND mp2.user_id = profiles.user_id
      AND m.status IN ('open', 'started')  -- Only active matches, not completed/cancelled
  ))
  OR
  -- Admins can view all profiles
  has_role(auth.uid(), 'admin'::app_role)
);

-- Fix 2: Remove direct admin access to private_profile_data
-- Admins must use the secure edge function with audit logging instead

DROP POLICY IF EXISTS "Users can view only their own private data" ON private_profile_data;

CREATE POLICY "Users can view only their own private data"
ON private_profile_data FOR SELECT
USING (user_id = auth.uid());
-- Removed: OR has_role(auth.uid(), 'admin'::app_role)
-- Admins must now use get_user_private_data() function or edge function with audit logging