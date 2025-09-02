-- Fix critical security vulnerability: Remove public access to profiles table
-- This prevents unauthorized access to phone numbers and personal data

-- Drop the dangerous public policy
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;

-- Create a secure policy that only allows users to view their own profile
CREATE POLICY "Users can view their own profile" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() = user_id);

-- Optional: Create a limited public policy for display names only (commented out for maximum security)
-- Uncomment this if you need public display names for features like leaderboards
-- CREATE POLICY "Public can view display names only" 
-- ON public.profiles 
-- FOR SELECT 
-- USING (true)
-- WITH CHECK (false); -- This would need a custom view that only exposes display_name