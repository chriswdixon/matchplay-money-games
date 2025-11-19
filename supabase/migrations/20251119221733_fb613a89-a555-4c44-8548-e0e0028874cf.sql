-- Schedule the flag_incomplete_matches function to run every hour
-- This will automatically flag matches that are more than 24 hours past their scheduled time
-- and haven't been completed by all players
SELECT cron.schedule(
  'flag-incomplete-matches-hourly',
  '0 * * * *', -- Run at the top of every hour (0 minutes past the hour)
  $$
  SELECT flag_incomplete_matches();
  $$
);