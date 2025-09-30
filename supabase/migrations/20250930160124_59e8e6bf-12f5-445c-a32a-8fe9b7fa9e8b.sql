-- Add booking_url column to matches table
ALTER TABLE public.matches 
ADD COLUMN booking_url text;

-- Add comment for documentation
COMMENT ON COLUMN public.matches.booking_url IS 'URL to the golf course tee time booking page';