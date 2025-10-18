-- Consolidate multiple permissive RLS policies for better performance

-- 1. double_down_participants SELECT policies
DROP POLICY IF EXISTS "Match participants can view all double down statuses" ON public.double_down_participants;
DROP POLICY IF EXISTS "Users can view their own double down status" ON public.double_down_participants;

CREATE POLICY "Users can view double down participation"
ON public.double_down_participants
FOR SELECT
TO authenticated
USING (
  user_id = (SELECT auth.uid())
  OR EXISTS (
    SELECT 1
    FROM match_participants mp
    WHERE mp.match_id = double_down_participants.match_id 
      AND mp.user_id = (SELECT auth.uid())
  )
);

-- 2. match_join_tokens SELECT policies
DROP POLICY IF EXISTS "Match participants can view tokens" ON public.match_join_tokens;
DROP POLICY IF EXISTS "Users can view tokens they created" ON public.match_join_tokens;

CREATE POLICY "Users can view match join tokens"
ON public.match_join_tokens
FOR SELECT
TO authenticated
USING (
  created_by = (SELECT auth.uid())
  OR EXISTS (
    SELECT 1
    FROM match_participants mp
    WHERE mp.match_id = match_join_tokens.match_id 
      AND mp.user_id = (SELECT auth.uid())
  )
);

-- 3. matches DELETE policies
DROP POLICY IF EXISTS "Creators can manage their matches" ON public.matches;
DROP POLICY IF EXISTS "Match creators can delete their matches" ON public.matches;

CREATE POLICY "Match creators can delete matches"
ON public.matches
FOR DELETE
TO authenticated
USING (created_by = (SELECT auth.uid()));

-- 4. matches INSERT policy (keep single policy, remove duplicate)
DROP POLICY IF EXISTS "Users can create matches" ON public.matches;

CREATE POLICY "Users can create matches"
ON public.matches
FOR INSERT
TO authenticated
WITH CHECK (created_by = (SELECT auth.uid()));

-- 5. matches SELECT policy
CREATE POLICY "Users can view matches"
ON public.matches
FOR SELECT
TO authenticated
USING (
  status = 'open'
  OR created_by = (SELECT auth.uid())
  OR is_user_match_participant(id, (SELECT auth.uid()))
);

-- 6. matches UPDATE policy (from the ALL policy)
CREATE POLICY "Match creators can update matches"
ON public.matches
FOR UPDATE
TO authenticated
USING (created_by = (SELECT auth.uid()))
WITH CHECK (created_by = (SELECT auth.uid()));

-- 7. user_roles SELECT policies
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;

CREATE POLICY "Users can view roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (
  user_id = (SELECT auth.uid())
  OR has_role((SELECT auth.uid()), 'admin')
);

-- Recreate admin management policies for user_roles
CREATE POLICY "Admins can insert roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (has_role((SELECT auth.uid()), 'admin'));

CREATE POLICY "Admins can update roles"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (has_role((SELECT auth.uid()), 'admin'))
WITH CHECK (has_role((SELECT auth.uid()), 'admin'));

CREATE POLICY "Admins can delete roles"
ON public.user_roles
FOR DELETE
TO authenticated
USING (has_role((SELECT auth.uid()), 'admin'));