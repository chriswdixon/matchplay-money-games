-- Enable realtime for matches table
ALTER TABLE public.matches REPLICA IDENTITY FULL;
ALTER publication supabase_realtime ADD TABLE public.matches;