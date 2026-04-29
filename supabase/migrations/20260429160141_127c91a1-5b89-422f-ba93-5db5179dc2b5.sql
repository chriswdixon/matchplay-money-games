-- Wins feed table
CREATE TABLE public.match_win_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL,
  winner_user_id uuid NOT NULL,
  course_name text NOT NULL,
  format text NOT NULL,
  holes integer NOT NULL DEFAULT 18,
  is_team_win boolean NOT NULL DEFAULT false,
  team_number integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_match_win_posts_created_at ON public.match_win_posts (created_at DESC);
CREATE INDEX idx_match_win_posts_winner ON public.match_win_posts (winner_user_id);
CREATE UNIQUE INDEX uniq_match_win_posts_match_winner ON public.match_win_posts (match_id, winner_user_id);

ALTER TABLE public.match_win_posts ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view the feed
CREATE POLICY "Authenticated users can view win posts"
ON public.match_win_posts
FOR SELECT
TO authenticated
USING (true);

-- Block direct writes from clients; trigger (security definer) handles inserts
CREATE POLICY "Deny client inserts on win posts"
ON public.match_win_posts
FOR INSERT
TO authenticated
WITH CHECK (false);

CREATE POLICY "Deny client updates on win posts"
ON public.match_win_posts
FOR UPDATE
TO authenticated
USING (false)
WITH CHECK (false);

-- Admins can delete (e.g. moderation)
CREATE POLICY "Admins can delete win posts"
ON public.match_win_posts
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger function: when a match_result is finalized, insert one row per winner
CREATE OR REPLACE FUNCTION public.create_win_posts_on_finalize()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_match record;
  v_winner uuid;
  v_team integer;
BEGIN
  -- Only act when finalized_at transitions to non-null
  IF NEW.finalized_at IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.finalized_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT id, course_name, format, holes, is_team_format
    INTO v_match
  FROM public.matches
  WHERE id = NEW.match_id;

  IF v_match.id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Insert from winners array (preferred)
  IF NEW.winners IS NOT NULL AND array_length(NEW.winners, 1) > 0 THEN
    FOREACH v_winner IN ARRAY NEW.winners LOOP
      SELECT team_number INTO v_team
      FROM public.match_participants
      WHERE match_id = NEW.match_id AND user_id = v_winner
      LIMIT 1;

      INSERT INTO public.match_win_posts
        (match_id, winner_user_id, course_name, format, holes, is_team_win, team_number)
      VALUES
        (NEW.match_id, v_winner, v_match.course_name, v_match.format, COALESCE(v_match.holes, 18),
         COALESCE(v_match.is_team_format, false), v_team)
      ON CONFLICT (match_id, winner_user_id) DO NOTHING;
    END LOOP;
  ELSIF NEW.winner_id IS NOT NULL THEN
    SELECT team_number INTO v_team
    FROM public.match_participants
    WHERE match_id = NEW.match_id AND user_id = NEW.winner_id
    LIMIT 1;

    INSERT INTO public.match_win_posts
      (match_id, winner_user_id, course_name, format, holes, is_team_win, team_number)
    VALUES
      (NEW.match_id, NEW.winner_id, v_match.course_name, v_match.format, COALESCE(v_match.holes, 18),
       COALESCE(v_match.is_team_format, false), v_team)
    ON CONFLICT (match_id, winner_user_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_create_win_posts_on_finalize
AFTER INSERT OR UPDATE OF finalized_at, winners, winner_id
ON public.match_results
FOR EACH ROW
EXECUTE FUNCTION public.create_win_posts_on_finalize();

REVOKE EXECUTE ON FUNCTION public.create_win_posts_on_finalize() FROM PUBLIC, anon, authenticated;