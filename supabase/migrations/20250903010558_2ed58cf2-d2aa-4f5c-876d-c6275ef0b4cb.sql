-- Create function to handle match cancellation when last participant leaves
CREATE OR REPLACE FUNCTION public.handle_participant_removal()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if this was the last participant in the match
  IF NOT EXISTS (
    SELECT 1 FROM public.match_participants 
    WHERE match_id = OLD.match_id
  ) THEN
    -- No participants left, cancel the match
    UPDATE public.matches 
    SET status = 'cancelled', updated_at = now()
    WHERE id = OLD.match_id;
  END IF;
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger that fires after a participant is deleted
CREATE TRIGGER trigger_handle_participant_removal
  AFTER DELETE ON public.match_participants
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_participant_removal();