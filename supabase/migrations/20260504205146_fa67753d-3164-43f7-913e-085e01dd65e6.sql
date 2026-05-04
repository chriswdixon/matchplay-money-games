
-- Notifications table
CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  match_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user_unread
  ON public.notifications (user_id, created_at DESC)
  WHERE read_at IS NULL;
CREATE INDEX idx_notifications_user_created
  ON public.notifications (user_id, created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own notifications"
  ON public.notifications FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can mark their own notifications read"
  ON public.notifications FOR UPDATE
  TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "Service role can insert notifications"
  ON public.notifications FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Service role can delete notifications"
  ON public.notifications FOR DELETE
  TO service_role
  USING (true);

-- Trigger: notify match creator when someone joins
CREATE OR REPLACE FUNCTION public.notify_match_creator_on_join()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_creator UUID;
  v_course TEXT;
  v_joiner_name TEXT;
BEGIN
  SELECT created_by, course_name INTO v_creator, v_course
    FROM public.matches WHERE id = NEW.match_id;

  IF v_creator IS NULL OR v_creator = NEW.user_id THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(display_name, first_name, 'A player')
    INTO v_joiner_name FROM public.profiles WHERE user_id = NEW.user_id LIMIT 1;

  INSERT INTO public.notifications (user_id, type, title, body, match_id, metadata)
  VALUES (
    v_creator,
    'match_join',
    'New player joined your match',
    COALESCE(v_joiner_name, 'A player') || ' joined your match at ' || COALESCE(v_course, 'your course'),
    NEW.match_id,
    jsonb_build_object('joined_user_id', NEW.user_id)
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_match_creator_on_join
AFTER INSERT ON public.match_participants
FOR EACH ROW EXECUTE FUNCTION public.notify_match_creator_on_join();

-- Trigger: notify all participants when match result is finalized
CREATE OR REPLACE FUNCTION public.notify_participants_on_finalize()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_course TEXT;
  rec RECORD;
BEGIN
  IF NEW.finalized_at IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.finalized_at IS NOT NULL THEN RETURN NEW; END IF;

  SELECT course_name INTO v_course FROM public.matches WHERE id = NEW.match_id;

  FOR rec IN
    SELECT user_id FROM public.match_participants WHERE match_id = NEW.match_id
  LOOP
    INSERT INTO public.notifications (user_id, type, title, body, match_id, metadata)
    VALUES (
      rec.user_id,
      'match_finalized',
      'Match results are in',
      'Your match at ' || COALESCE(v_course, 'the course') || ' has been finalized.',
      NEW.match_id,
      jsonb_build_object('winner_id', NEW.winner_id)
    );
  END LOOP;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_participants_on_finalize
AFTER INSERT OR UPDATE OF finalized_at ON public.match_results
FOR EACH ROW EXECUTE FUNCTION public.notify_participants_on_finalize();

-- Trigger: notify cancelling player when a cancellation review is opened
CREATE OR REPLACE FUNCTION public.notify_on_cancellation_review()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notifications (user_id, type, title, body, match_id, metadata)
  VALUES (
    NEW.cancelling_player_id,
    'cancellation_review',
    'Cancellation under review',
    'Your match cancellation is being reviewed by an admin.',
    NEW.match_id,
    jsonb_build_object('review_id', NEW.id)
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_on_cancellation_review
AFTER INSERT ON public.match_cancellation_reviews
FOR EACH ROW EXECUTE FUNCTION public.notify_on_cancellation_review();

-- Realtime
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
