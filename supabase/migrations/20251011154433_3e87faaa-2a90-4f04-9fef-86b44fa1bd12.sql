-- Function to check if match should be cancelled after all players confirm weather/course cancellation
CREATE OR REPLACE FUNCTION public.check_and_cancel_match_after_confirmation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  total_confirmations_needed integer;
  confirmed_count integer;
  cancellation_reason text;
  is_weather_or_course boolean;
BEGIN
  -- Only process when a confirmation is marked as confirmed
  IF NEW.confirmed = true AND (OLD.confirmed IS NULL OR OLD.confirmed = false) THEN
    
    -- Get the stated reason for this cancellation
    SELECT stated_reason INTO cancellation_reason
    FROM match_cancellation_confirmations
    WHERE id = NEW.id;
    
    -- Check if reason is weather or course-closure (NOT equipment)
    is_weather_or_course := cancellation_reason IN (
      'lightning', 'rain', 'temperature', 'course-closure'
    );
    
    -- Only proceed if it's a weather or course-closure reason
    IF is_weather_or_course THEN
      
      -- Count total confirmations needed for this match and cancelling player
      SELECT COUNT(*) INTO total_confirmations_needed
      FROM match_cancellation_confirmations
      WHERE match_id = NEW.match_id
        AND cancelling_player_id = NEW.cancelling_player_id;
      
      -- Count how many are confirmed
      SELECT COUNT(*) INTO confirmed_count
      FROM match_cancellation_confirmations
      WHERE match_id = NEW.match_id
        AND cancelling_player_id = NEW.cancelling_player_id
        AND confirmed = true;
      
      -- If all confirmations are in, cancel the match
      IF confirmed_count >= total_confirmations_needed THEN
        
        -- Cancel the match for everyone
        UPDATE matches
        SET status = 'cancelled', updated_at = now()
        WHERE id = NEW.match_id;
        
        -- Mark all participants as left
        UPDATE match_participants
        SET status = 'left'
        WHERE match_id = NEW.match_id;
        
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger to check after each confirmation
CREATE TRIGGER after_cancellation_confirmation
AFTER UPDATE ON match_cancellation_confirmations
FOR EACH ROW
EXECUTE FUNCTION public.check_and_cancel_match_after_confirmation();