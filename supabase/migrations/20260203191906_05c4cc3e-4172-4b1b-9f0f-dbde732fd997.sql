-- Add $500 (50000 cents) to all existing player accounts
UPDATE player_accounts
SET balance = balance + 50000,
    updated_at = now();