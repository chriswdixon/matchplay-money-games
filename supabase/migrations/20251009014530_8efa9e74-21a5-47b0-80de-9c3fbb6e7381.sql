-- Enable real-time for match_confirmations table
ALTER TABLE public.match_confirmations REPLICA IDENTITY FULL;