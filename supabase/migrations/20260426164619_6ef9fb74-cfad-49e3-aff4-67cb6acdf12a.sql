-- =========================================================================
-- AUDIT LOG: admin-only reconciliation trail for scores, payments, payouts
-- =========================================================================

-- 1. Category enum
DO $$ BEGIN
  CREATE TYPE public.audit_category AS ENUM (
    'score',
    'transaction',
    'payout',
    'dispute',
    'admin_override'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Table
CREATE TABLE IF NOT EXISTS public.audit_log (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at    timestamptz NOT NULL DEFAULT now(),
  category      public.audit_category NOT NULL,
  event_type    text NOT NULL,
  match_id      uuid,
  user_id       uuid,
  actor_id      uuid,
  summary       text NOT NULL,
  payload       jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS audit_log_match_id_idx   ON public.audit_log (match_id);
CREATE INDEX IF NOT EXISTS audit_log_user_id_idx    ON public.audit_log (user_id);
CREATE INDEX IF NOT EXISTS audit_log_created_at_idx ON public.audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS audit_log_category_idx   ON public.audit_log (category);

-- 3. Enable RLS
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- 4. Policies — admin-only SELECT, no client-side writes
DROP POLICY IF EXISTS "Admins can view audit log"      ON public.audit_log;
DROP POLICY IF EXISTS "Deny client inserts on audit"   ON public.audit_log;
DROP POLICY IF EXISTS "Deny client updates on audit"   ON public.audit_log;
DROP POLICY IF EXISTS "Deny client deletes on audit"   ON public.audit_log;

CREATE POLICY "Admins can view audit log"
  ON public.audit_log
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Deny client inserts on audit"
  ON public.audit_log
  FOR INSERT
  TO authenticated
  WITH CHECK (false);

CREATE POLICY "Deny client updates on audit"
  ON public.audit_log
  FOR UPDATE
  TO authenticated
  USING (false)
  WITH CHECK (false);

CREATE POLICY "Deny client deletes on audit"
  ON public.audit_log
  FOR DELETE
  TO authenticated
  USING (false);

-- (Service role bypasses RLS, so edge functions can still INSERT.)

-- =========================================================================
-- 5. Helper function (SECURITY DEFINER) used by triggers
-- =========================================================================
CREATE OR REPLACE FUNCTION public.write_audit_log(
  p_category   public.audit_category,
  p_event_type text,
  p_match_id   uuid,
  p_user_id    uuid,
  p_actor_id   uuid,
  p_summary    text,
  p_payload    jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.audit_log
    (category, event_type, match_id, user_id, actor_id, summary, payload)
  VALUES
    (p_category, p_event_type, p_match_id, p_user_id, p_actor_id, p_summary, COALESCE(p_payload, '{}'::jsonb));
END;
$$;

-- =========================================================================
-- 6. Trigger: match_scores  (score events)
-- =========================================================================
CREATE OR REPLACE FUNCTION public.audit_match_scores()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_event text;
  v_summary text;
  v_payload jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_event := 'score.created';
    v_summary := format('Hole %s score recorded: %s strokes',
                        NEW.hole_number, COALESCE(NEW.strokes::text, 'null'));
    v_payload := jsonb_build_object(
      'hole_number', NEW.hole_number,
      'strokes',     NEW.strokes,
      'player_id',   NEW.player_id
    );
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.strokes IS DISTINCT FROM OLD.strokes THEN
      v_event := 'score.updated';
      v_summary := format('Hole %s score changed: %s -> %s',
                          NEW.hole_number,
                          COALESCE(OLD.strokes::text, 'null'),
                          COALESCE(NEW.strokes::text, 'null'));
      v_payload := jsonb_build_object(
        'hole_number',  NEW.hole_number,
        'old_strokes',  OLD.strokes,
        'new_strokes',  NEW.strokes,
        'player_id',    NEW.player_id
      );
    ELSE
      RETURN NEW; -- no meaningful change
    END IF;
  END IF;

  PERFORM public.write_audit_log(
    'score'::public.audit_category,
    v_event,
    NEW.match_id,
    NEW.player_id,
    v_actor,
    v_summary,
    v_payload
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_match_scores ON public.match_scores;
CREATE TRIGGER trg_audit_match_scores
  AFTER INSERT OR UPDATE ON public.match_scores
  FOR EACH ROW EXECUTE FUNCTION public.audit_match_scores();

-- =========================================================================
-- 7. Trigger: match_results
-- =========================================================================
CREATE OR REPLACE FUNCTION public.audit_match_results()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_event text;
  v_summary text;
  v_payload jsonb;
  v_match  uuid;
  v_user   uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_event := 'result.deleted';
    v_match := OLD.match_id;
    v_user  := OLD.winner_id;
    v_summary := format('Match result deleted (winner_id=%s)', COALESCE(OLD.winner_id::text, 'null'));
    v_payload := jsonb_build_object(
      'final_scores',      OLD.final_scores,
      'winners',           OLD.winners,
      'forfeited_players', OLD.forfeited_players
    );
  ELSE
    v_match := NEW.match_id;
    v_user  := NEW.winner_id;
    IF TG_OP = 'INSERT' THEN
      v_event := 'result.created';
      v_summary := format('Match result finalized (winner_id=%s)', COALESCE(NEW.winner_id::text, 'null'));
    ELSE
      v_event := 'result.updated';
      v_summary := 'Match result updated';
    END IF;
    v_payload := jsonb_build_object(
      'final_scores',      NEW.final_scores,
      'winners',           NEW.winners,
      'forfeited_players', NEW.forfeited_players,
      'finalized_by',      NEW.finalized_by
    );
  END IF;

  PERFORM public.write_audit_log(
    'score'::public.audit_category,
    v_event, v_match, v_user, v_actor, v_summary, v_payload
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_match_results ON public.match_results;
CREATE TRIGGER trg_audit_match_results
  AFTER INSERT OR UPDATE OR DELETE ON public.match_results
  FOR EACH ROW EXECUTE FUNCTION public.audit_match_results();

-- =========================================================================
-- 8. Trigger: account_transactions  (every credit/debit)
-- =========================================================================
CREATE OR REPLACE FUNCTION public.audit_account_transactions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_cat   public.audit_category;
  v_type  text := NEW.transaction_type::text;
BEGIN
  -- Map transaction type to audit category
  IF v_type ILIKE '%payout%' THEN
    v_cat := 'payout';
  ELSIF v_type ILIKE '%dispute%' OR v_type ILIKE '%refund%' THEN
    v_cat := 'dispute';
  ELSE
    v_cat := 'transaction';
  END IF;

  PERFORM public.write_audit_log(
    v_cat,
    'transaction.' || v_type,
    NEW.match_id,
    NEW.user_id,
    v_actor,
    format('%s of %s recorded: %s', v_type, NEW.amount, NEW.description),
    jsonb_build_object(
      'amount',           NEW.amount,
      'transaction_type', v_type,
      'account_id',       NEW.account_id,
      'metadata',         NEW.metadata,
      'stripe_payment_intent_id', NEW.stripe_payment_intent_id
    )
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_account_transactions ON public.account_transactions;
CREATE TRIGGER trg_audit_account_transactions
  AFTER INSERT ON public.account_transactions
  FOR EACH ROW EXECUTE FUNCTION public.audit_account_transactions();

-- =========================================================================
-- 9. Trigger: match_participants  (status changes — forfeits / admin removals)
-- =========================================================================
CREATE OR REPLACE FUNCTION public.audit_match_participants()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_is_admin boolean := COALESCE(public.has_role(v_actor, 'admin'::public.app_role), false);
  v_self boolean := (v_actor = NEW.user_id);
  v_cat public.audit_category;
  v_event text;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    -- Admin-driven changes go to admin_override; self-driven stay as score events
    IF v_is_admin AND NOT v_self THEN
      v_cat := 'admin_override';
      v_event := 'participant.status.admin_changed';
    ELSE
      v_cat := 'score';
      v_event := 'participant.status.changed';
    END IF;

    PERFORM public.write_audit_log(
      v_cat, v_event,
      NEW.match_id, NEW.user_id, v_actor,
      format('Participant status %s -> %s', OLD.status, NEW.status),
      jsonb_build_object(
        'old_status', OLD.status,
        'new_status', NEW.status,
        'team_number', NEW.team_number
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_match_participants ON public.match_participants;
CREATE TRIGGER trg_audit_match_participants
  AFTER UPDATE ON public.match_participants
  FOR EACH ROW EXECUTE FUNCTION public.audit_match_participants();
