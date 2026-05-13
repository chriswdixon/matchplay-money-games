
CREATE OR REPLACE FUNCTION public.auto_credit_match_winnings()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_match RECORD;
  v_participant RECORD;
  v_winner_id UUID;
  v_winners UUID[];
  v_pot NUMERIC := 0;
  v_payout NUMERIC;
  v_account_id UUID;
  v_existing_buyin INT;
BEGIN
  -- Only run when finalized_at transitions to non-null
  IF NEW.finalized_at IS NULL THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.finalized_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT id, buy_in_amount, is_team_format
    INTO v_match
  FROM public.matches
  WHERE id = NEW.match_id;

  IF v_match.id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Ensure every active participant has a buy-in transaction; debit if missing
  FOR v_participant IN
    SELECT mp.user_id
    FROM public.match_participants mp
    WHERE mp.match_id = NEW.match_id
      AND mp.status = 'active'
  LOOP
    SELECT COUNT(*) INTO v_existing_buyin
    FROM public.account_transactions
    WHERE match_id = NEW.match_id
      AND user_id = v_participant.user_id
      AND transaction_type = 'match_buyin';

    IF v_existing_buyin = 0 AND v_match.buy_in_amount > 0 THEN
      SELECT id INTO v_account_id
      FROM public.player_accounts
      WHERE user_id = v_participant.user_id;

      IF v_account_id IS NOT NULL THEN
        BEGIN
          INSERT INTO public.account_transactions
            (user_id, account_id, amount, transaction_type, match_id, description, metadata)
          VALUES
            (v_participant.user_id, v_account_id, -v_match.buy_in_amount, 'match_buyin', NEW.match_id,
             'Match buy-in (auto-reconciled on finalize)',
             jsonb_build_object('auto_reconciled', true));

          PERFORM public.debit_player_balance(v_participant.user_id, v_match.buy_in_amount);
        EXCEPTION WHEN unique_violation THEN
          NULL;
        END;
      END IF;
    END IF;

    v_pot := v_pot + v_match.buy_in_amount;
  END LOOP;

  -- Build winners list
  IF NEW.winners IS NOT NULL AND array_length(NEW.winners, 1) > 0 THEN
    v_winners := NEW.winners;
  ELSIF NEW.winner_id IS NOT NULL THEN
    v_winners := ARRAY[NEW.winner_id];
  ELSE
    RETURN NEW;
  END IF;

  IF v_pot <= 0 THEN
    RETURN NEW;
  END IF;

  v_payout := floor(v_pot / array_length(v_winners, 1));

  -- Credit each winner (idempotent via unique index on winnings)
  FOREACH v_winner_id IN ARRAY v_winners LOOP
    SELECT id INTO v_account_id
    FROM public.player_accounts
    WHERE user_id = v_winner_id;

    IF v_account_id IS NULL THEN
      CONTINUE;
    END IF;

    BEGIN
      INSERT INTO public.account_transactions
        (user_id, account_id, amount, transaction_type, match_id, description, metadata)
      VALUES
        (v_winner_id, v_account_id, v_payout, 'winning', NEW.match_id,
         'Match winnings' || CASE WHEN array_length(v_winners,1) > 1 THEN ' (split)' ELSE '' END,
         jsonb_build_object(
           'auto_credited', true,
           'pot', v_pot,
           'winner_count', array_length(v_winners, 1),
           'is_team_format', COALESCE(v_match.is_team_format, false)
         ));

      PERFORM public.credit_player_balance(v_winner_id, v_payout);
    EXCEPTION WHEN unique_violation THEN
      -- already credited, skip
      NULL;
    END;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_credit_match_winnings_ins ON public.match_results;
DROP TRIGGER IF EXISTS trg_auto_credit_match_winnings_upd ON public.match_results;

CREATE TRIGGER trg_auto_credit_match_winnings_ins
AFTER INSERT ON public.match_results
FOR EACH ROW
WHEN (NEW.finalized_at IS NOT NULL)
EXECUTE FUNCTION public.auto_credit_match_winnings();

CREATE TRIGGER trg_auto_credit_match_winnings_upd
AFTER UPDATE OF finalized_at, winners, winner_id ON public.match_results
FOR EACH ROW
WHEN (NEW.finalized_at IS NOT NULL AND OLD.finalized_at IS DISTINCT FROM NEW.finalized_at)
EXECUTE FUNCTION public.auto_credit_match_winnings();
