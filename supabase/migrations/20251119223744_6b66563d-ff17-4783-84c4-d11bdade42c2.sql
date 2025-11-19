-- Create function to clean up orphaned participants when match is cancelled
CREATE OR REPLACE FUNCTION public.cleanup_orphaned_participants()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- When a match is cancelled, mark all active participants as left
  IF NEW.status = 'cancelled' AND (OLD.status IS NULL OR OLD.status != 'cancelled') THEN
    UPDATE public.match_participants
    SET status = 'left'
    WHERE match_id = NEW.id
      AND status = 'active';
    
    RAISE NOTICE 'Cleaned up % orphaned participants for cancelled match %', 
      (SELECT COUNT(*) FROM public.match_participants WHERE match_id = NEW.id AND status = 'left'),
      NEW.id;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Create trigger to automatically cleanup participants when match is cancelled
DROP TRIGGER IF EXISTS trigger_cleanup_orphaned_participants ON public.matches;
CREATE TRIGGER trigger_cleanup_orphaned_participants
  AFTER UPDATE OF status ON public.matches
  FOR EACH ROW
  EXECUTE FUNCTION public.cleanup_orphaned_participants();