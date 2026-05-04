-- Extend audit category enum
ALTER TYPE public.audit_category ADD VALUE IF NOT EXISTS 'access';

COMMIT;
BEGIN;

-- Generic audit insert helper (SECURITY DEFINER bypasses RLS deny-insert policy)
CREATE OR REPLACE FUNCTION public.write_audit(
  p_category public.audit_category,
  p_event_type text,
  p_summary text,
  p_match_id uuid DEFAULT NULL,
  p_user_id uuid DEFAULT NULL,
  p_actor_id uuid DEFAULT NULL,
  p_payload jsonb DEFAULT '{}'::jsonb
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.audit_log(category, event_type, summary, match_id, user_id, actor_id, payload)
  VALUES (p_category, p_event_type, p_summary, p_match_id, p_user_id, p_actor_id, COALESCE(p_payload, '{}'::jsonb));
END;
$$;

REVOKE EXECUTE ON FUNCTION public.write_audit(public.audit_category, text, text, uuid, uuid, uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.write_audit(public.audit_category, text, text, uuid, uuid, uuid, jsonb) TO service_role;

-- Trigger: match created (booking)
CREATE OR REPLACE FUNCTION public.tg_audit_match_created()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.write_audit(
    'transaction'::public.audit_category,
    'match_created',
    'Match booked: ' || COALESCE(NEW.course_name, 'unknown course'),
    NEW.id, NEW.created_by, NEW.created_by,
    jsonb_build_object(
      'format', NEW.format,
      'buy_in_amount', NEW.buy_in_amount,
      'scheduled_time', NEW.scheduled_time,
      'max_participants', NEW.max_participants
    )
  );
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS audit_match_created ON public.matches;
CREATE TRIGGER audit_match_created
AFTER INSERT ON public.matches
FOR EACH ROW EXECUTE FUNCTION public.tg_audit_match_created();

-- Trigger: match status transitions (e.g., started/cancelled/completed)
CREATE OR REPLACE FUNCTION public.tg_audit_match_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    PERFORM public.write_audit(
      'transaction'::public.audit_category,
      'match_status_changed',
      'Match status: ' || OLD.status || ' -> ' || NEW.status,
      NEW.id, NEW.created_by, auth.uid(),
      jsonb_build_object('old_status', OLD.status, 'new_status', NEW.status)
    );
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS audit_match_status ON public.matches;
CREATE TRIGGER audit_match_status
AFTER UPDATE ON public.matches
FOR EACH ROW EXECUTE FUNCTION public.tg_audit_match_status();

-- Trigger: participant join/leave
CREATE OR REPLACE FUNCTION public.tg_audit_participant_join()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.write_audit(
    'access'::public.audit_category,
    'match_joined',
    'User joined match',
    NEW.match_id, NEW.user_id, COALESCE(auth.uid(), NEW.user_id),
    jsonb_build_object('team_number', NEW.team_number, 'status', NEW.status)
  );
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS audit_participant_join ON public.match_participants;
CREATE TRIGGER audit_participant_join
AFTER INSERT ON public.match_participants
FOR EACH ROW EXECUTE FUNCTION public.tg_audit_participant_join();

CREATE OR REPLACE FUNCTION public.tg_audit_participant_leave()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.write_audit(
    'access'::public.audit_category,
    'match_left',
    'User left match',
    OLD.match_id, OLD.user_id, COALESCE(auth.uid(), OLD.user_id),
    jsonb_build_object('team_number', OLD.team_number)
  );
  RETURN OLD;
END $$;

DROP TRIGGER IF EXISTS audit_participant_leave ON public.match_participants;
CREATE TRIGGER audit_participant_leave
AFTER DELETE ON public.match_participants
FOR EACH ROW EXECUTE FUNCTION public.tg_audit_participant_leave();

-- Trigger: scoring inserts/updates
CREATE OR REPLACE FUNCTION public.tg_audit_match_score()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_event text;
  v_old int;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_event := 'score_recorded';
    v_old := NULL;
  ELSE
    IF NEW.strokes IS NOT DISTINCT FROM OLD.strokes THEN
      RETURN NEW;
    END IF;
    v_event := 'score_updated';
    v_old := OLD.strokes;
  END IF;

  PERFORM public.write_audit(
    'score'::public.audit_category,
    v_event,
    'Hole ' || NEW.hole_number || ' score recorded',
    NEW.match_id, NEW.player_id, COALESCE(auth.uid(), NEW.player_id),
    jsonb_build_object('hole', NEW.hole_number, 'strokes', NEW.strokes, 'old_strokes', v_old)
  );
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS audit_match_score ON public.match_scores;
CREATE TRIGGER audit_match_score
AFTER INSERT OR UPDATE ON public.match_scores
FOR EACH ROW EXECUTE FUNCTION public.tg_audit_match_score();

-- Trigger: failed pin attempts (membership check abuse)
CREATE OR REPLACE FUNCTION public.tg_audit_pin_attempt()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT NEW.success THEN
    PERFORM public.write_audit(
      'access'::public.audit_category,
      'pin_attempt_failed',
      'Failed pin attempt for match',
      NEW.match_id, NEW.user_id, NEW.user_id,
      jsonb_build_object('team_number', NEW.team_number, 'ip_address', NEW.ip_address)
    );
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS audit_pin_attempt ON public.pin_attempts;
CREATE TRIGGER audit_pin_attempt
AFTER INSERT ON public.pin_attempts
FOR EACH ROW EXECUTE FUNCTION public.tg_audit_pin_attempt();

COMMIT;