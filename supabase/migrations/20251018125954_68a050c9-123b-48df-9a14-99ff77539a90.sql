-- Fix duplicate indexes on profiles table
-- Drop redundant unique index (keeping profiles_user_id_key)

DROP INDEX IF EXISTS public.profiles_user_id_unique;