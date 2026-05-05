
-- Re-add the matches table to the realtime publication WITHOUT a column filter,
-- so updates aren't blocked by "publication does not cover the replica identity".
ALTER PUBLICATION supabase_realtime DROP TABLE public.matches;
ALTER PUBLICATION supabase_realtime ADD TABLE public.matches;
