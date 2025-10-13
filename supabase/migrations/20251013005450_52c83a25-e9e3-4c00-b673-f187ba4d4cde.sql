-- Update leave_match_with_dnf function to handle account transactions
CREATE OR REPLACE FUNCTION public.leave_match_with_dnf(p_match_id uuid, p_user_id uuid, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  active_participants_count integer;
  match_status_check text;
  result jsonb;
  participant_status text;
  is_weather_or_course boolean;
  match_buy_in integer;
  user_account_id uuid;
  cancellation_fee integer := 200; -- $2.00 in cents
  refund_amount integer;
BEGIN
  -- Security: Check if user is a participant
  IF NOT EXISTS (
    SELECT 1 FROM public.match_participants 
    WHERE match_id = p_match_id AND user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'Access denied: You are not a participant in this match';
  END IF;

  -- Check if reason is weather or course-related (eligible for refund)
  is_weather_or_course := p_reason IN (
    'lightning', 'rain', 'temperature', 
    'course-closure', 'wildlife'
  );

  -- Get match details
  SELECT status, buy_in_amount INTO match_status_check, match_buy_in
  FROM public.matches
  WHERE id = p_match_id;

  -- Get user's account ID
  SELECT id INTO user_account_id
  FROM public.player_accounts
  WHERE user_id = p_user_id;

  IF user_account_id IS NULL THEN
    RAISE EXCEPTION 'Player account not found';
  END IF;

  -- Count active participants (excluding current user)
  SELECT COUNT(*) INTO active_participants_count
  FROM public.match_participants
  WHERE match_id = p_match_id 
    AND status = 'active'
    AND user_id != p_user_id;

  -- Determine action based on active participants count
  IF active_participants_count >= 2 THEN
    -- 3+ players total (2+ remaining), mark as DNF
    UPDATE public.match_participants
    SET status = 'dnf'
    WHERE match_id = p_match_id AND user_id = p_user_id;
    
    participant_status := 'dnf';
    
    -- Process refund/forfeiture based on reason
    IF is_weather_or_course AND match_buy_in > 0 THEN
      -- Weather/course reason: Refund minus cancellation fee
      refund_amount := GREATEST(0, match_buy_in - cancellation_fee);
      
      -- Credit account with refund
      UPDATE public.player_accounts
      SET balance = balance + refund_amount
      WHERE id = user_account_id;
      
      -- Record refund transaction
      INSERT INTO public.account_transactions (
        user_id, account_id, amount, transaction_type, match_id, description
      ) VALUES (
        p_user_id, user_account_id, refund_amount, 'match_cancellation', p_match_id,
        format('Match cancellation refund (%s) - $2 cancellation fee applied', p_reason)
      );
      
      -- Record cancellation fee if there was one
      IF match_buy_in > cancellation_fee THEN
        INSERT INTO public.account_transactions (
          user_id, account_id, amount, transaction_type, match_id, description
        ) VALUES (
          p_user_id, user_account_id, -cancellation_fee, 'match_cancellation', p_match_id,
          'Match cancellation fee'
        );
      END IF;
    ELSIF NOT is_weather_or_course AND match_buy_in > 0 THEN
      -- Non-weather reason: Buy-in is forfeited (no refund)
      -- The buy-in stays in the prize pool for remaining players
      NULL; -- No transaction needed - they already paid
    END IF;
    
    -- Log in match results as forfeited
    INSERT INTO public.match_results (match_id, forfeited_players)
    VALUES (
      p_match_id,
      jsonb_build_array(
        jsonb_build_object(
          'user_id', p_user_id,
          'reason', p_reason,
          'timestamp', now(),
          'refund_eligible', is_weather_or_course,
          'refund_amount', CASE WHEN is_weather_or_course THEN refund_amount ELSE 0 END
        )
      )
    )
    ON CONFLICT (match_id) 
    DO UPDATE SET 
      forfeited_players = match_results.forfeited_players || 
        jsonb_build_array(
          jsonb_build_object(
            'user_id', p_user_id,
            'reason', p_reason,
            'timestamp', now(),
            'refund_eligible', is_weather_or_course,
            'refund_amount', CASE WHEN is_weather_or_course THEN refund_amount ELSE 0 END
          )
        );
    
  ELSE
    -- Less than 3 players total, everyone leaves and gets refunds
    -- Mark all participants as left
    UPDATE public.match_participants
    SET status = 'left'
    WHERE match_id = p_match_id;
    
    -- Cancel the match
    UPDATE public.matches
    SET status = 'cancelled'
    WHERE id = p_match_id;
    
    participant_status := 'left';
    
    -- Process refunds for all participants if match had buy-in
    IF match_buy_in > 0 THEN
      -- Refund all players minus cancellation fee
      FOR user_account_id IN 
        SELECT pa.id, pa.user_id
        FROM public.match_participants mp
        JOIN public.player_accounts pa ON pa.user_id = mp.user_id
        WHERE mp.match_id = p_match_id
      LOOP
        refund_amount := GREATEST(0, match_buy_in - cancellation_fee);
        
        -- Credit account
        UPDATE public.player_accounts
        SET balance = balance + refund_amount
        WHERE id = user_account_id;
        
        -- Record transaction
        INSERT INTO public.account_transactions (
          user_id, account_id, amount, transaction_type, match_id, description
        ) VALUES (
          (SELECT user_id FROM public.player_accounts WHERE id = user_account_id),
          user_account_id, 
          refund_amount, 
          'match_cancellation', 
          p_match_id,
          'Match cancelled - refund minus $2 cancellation fee'
        );
        
        -- Record cancellation fee
        IF match_buy_in > cancellation_fee THEN
          INSERT INTO public.account_transactions (
            user_id, account_id, amount, transaction_type, match_id, description
          ) VALUES (
            (SELECT user_id FROM public.player_accounts WHERE id = user_account_id),
            user_account_id, 
            -cancellation_fee, 
            'match_cancellation', 
            p_match_id,
            'Match cancellation fee'
          );
        END IF;
      END LOOP;
    END IF;
  END IF;

  result := jsonb_build_object(
    'status', participant_status,
    'remaining_players', active_participants_count,
    'match_status', CASE 
      WHEN active_participants_count >= 2 THEN match_status_check
      ELSE 'cancelled'
    END,
    'refund_eligible', is_weather_or_course,
    'refund_amount', CASE WHEN is_weather_or_course THEN refund_amount ELSE 0 END,
    'cancellation_fee', CASE WHEN match_buy_in > 0 THEN cancellation_fee ELSE 0 END
  );

  RETURN result;
END;
$$;