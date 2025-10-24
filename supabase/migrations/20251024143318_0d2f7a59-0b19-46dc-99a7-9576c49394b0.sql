
-- Fix stuck match by marking non-playing participant as DNF
-- This allows the remaining player to finalize the match
-- Match: 91fcbfbc-d30f-46da-9de0-022976a8bc6c (Southern oaks)
-- User who didn't play: 785267ea-daa5-42c0-9ac3-52ba8b5eabaf (Ribo22)

UPDATE public.match_participants 
SET status = 'dnf'
WHERE match_id = '91fcbfbc-d30f-46da-9de0-022976a8bc6c' 
  AND user_id = '785267ea-daa5-42c0-9ac3-52ba8b5eabaf'
  AND status = 'active';
