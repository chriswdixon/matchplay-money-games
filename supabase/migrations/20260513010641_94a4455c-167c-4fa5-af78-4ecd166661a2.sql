UPDATE public.matches
SET max_participants = 2, updated_at = now()
WHERE id = 'f09c6673-9bb7-446d-a7d6-f65c774f061e'
  AND status = 'open';