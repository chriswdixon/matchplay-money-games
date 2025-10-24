-- Delete stuck match 91fcbfbc-d30f-46da-9de0-022976a8bc6c (Southern oaks)
-- This match was started but never completed
-- No buy-in was charged (no transaction records exist)

-- Delete scores first (FK constraint)
DELETE FROM public.match_scores 
WHERE match_id = '91fcbfbc-d30f-46da-9de0-022976a8bc6c';

-- Delete participants (FK constraint)
DELETE FROM public.match_participants 
WHERE match_id = '91fcbfbc-d30f-46da-9de0-022976a8bc6c';

-- Finally delete the match
DELETE FROM public.matches 
WHERE id = '91fcbfbc-d30f-46da-9de0-022976a8bc6c';