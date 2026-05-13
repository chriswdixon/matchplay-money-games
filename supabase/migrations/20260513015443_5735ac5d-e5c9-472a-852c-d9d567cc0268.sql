
INSERT INTO account_transactions (user_id, account_id, amount, transaction_type, description, match_id) VALUES
  ('785267ea-daa5-42c0-9ac3-52ba8b5eabaf', '430e20fc-6ada-4b72-a993-5acaf926f842', -50, 'match_buyin', 'Match buy-in (manual reconciliation)', 'f09c6673-9bb7-446d-a7d6-f65c774f061e'),
  ('785267ea-daa5-42c0-9ac3-52ba8b5eabaf', '430e20fc-6ada-4b72-a993-5acaf926f842', 100, 'winning', 'Match payout - winner (manual reconciliation)', 'f09c6673-9bb7-446d-a7d6-f65c774f061e');

UPDATE player_accounts
SET balance = balance + 50, updated_at = now()
WHERE id = '430e20fc-6ada-4b72-a993-5acaf926f842';
