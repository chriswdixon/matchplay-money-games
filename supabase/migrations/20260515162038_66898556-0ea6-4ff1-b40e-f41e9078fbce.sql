
-- Fix 1: Restrict match_participants self-join to prevent bypass of PIN-protected teams
DROP POLICY IF EXISTS "Users can self-join matches" ON public.match_participants;

CREATE POLICY "Users can self-join matches"
ON public.match_participants
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = (SELECT auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.matches m
    WHERE m.id = match_participants.match_id
      AND m.status = 'open'
      AND (
        SELECT count(*) FROM public.match_participants mp
        WHERE mp.match_id = m.id AND mp.status = 'active'
      ) < m.max_participants
      AND (
        -- Non-team formats: allow direct join
        COALESCE(m.is_team_format, false) = false
        OR (
          -- Team formats: only allow if specified team has no PIN
          match_participants.team_number IS NOT NULL
          AND CASE match_participants.team_number
            WHEN 1 THEN COALESCE(m.team1_has_pin, false) = false
            WHEN 2 THEN COALESCE(m.team2_has_pin, false) = false
            WHEN 3 THEN COALESCE(m.team3_has_pin, false) = false
            WHEN 4 THEN COALESCE(m.team4_has_pin, false) = false
            ELSE false
          END
        )
      )
  )
);

-- Fix 2: Require active match membership for double_down_participants insert
DROP POLICY IF EXISTS "Users can insert their own double down participation" ON public.double_down_participants;

CREATE POLICY "Users can insert their own double down participation"
ON public.double_down_participants
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = (SELECT auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.match_participants mp
    WHERE mp.match_id = double_down_participants.match_id
      AND mp.user_id = (SELECT auth.uid())
      AND mp.status = 'active'
  )
);

-- Fix 3: Remove double_down_participants and notifications from realtime publication
-- so that per-user/financial data isn't broadcast to all match channel subscribers
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'double_down_participants'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime DROP TABLE public.double_down_participants';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'notifications'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime DROP TABLE public.notifications';
  END IF;
END $$;
