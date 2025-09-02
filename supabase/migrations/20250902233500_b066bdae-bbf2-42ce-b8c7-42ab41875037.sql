-- Fix user signup issue caused by security policy changes
-- The handle_new_user trigger needs special permissions to create profiles

-- Update the handle_new_user function to be a security definer
-- This allows it to bypass RLS policies when creating new user profiles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name, membership_tier)
  VALUES (
    NEW.id, 
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    'local'
  );
  RETURN NEW;
END;
$$;

-- Ensure the trigger exists (it should already exist, but this ensures it's properly set up)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();