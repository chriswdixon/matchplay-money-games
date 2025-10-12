-- Fix handle_new_user function to create profile and private data correctly
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert into profiles table
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (
    NEW.id, 
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1))
  );
  
  -- Insert into private_profile_data table
  INSERT INTO public.private_profile_data (user_id, membership_tier)
  VALUES (NEW.id, 'local');
  
  RETURN NEW;
END;
$$;