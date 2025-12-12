# Database Documentation

## Overview

MatchPlay uses PostgreSQL via Supabase with 23 tables, 75+ RLS policies, and several database functions and triggers for business logic enforcement.

## Entity Relationship Diagram

```
┌──────────────┐         ┌──────────────────────┐
│   auth.users │─────────│      profiles        │
└──────────────┘    1:1  │  - display_name      │
       │                 │  - handicap          │
       │                 │  - average_rating    │
       │                 └──────────────────────┘
       │
       │ 1:1     ┌────────────────────────┐
       ├─────────│  private_profile_data  │
       │         │  - phone               │
       │         │  - date_of_birth       │
       │         │  - membership_tier     │
       │         └────────────────────────┘
       │
       │ 1:1     ┌──────────────────┐
       ├─────────│  player_accounts │
       │         │  - balance       │
       │         └────────┬─────────┘
       │                  │ 1:N
       │         ┌────────┴─────────────────┐
       │         │   account_transactions   │
       │         │  - amount                │
       │         │  - transaction_type      │
       │         └──────────────────────────┘
       │
       │ 1:N     ┌──────────────────┐       1:N    ┌────────────────────┐
       ├─────────│     matches      │──────────────│ match_participants │
       │         │  - course_name   │              │  - team_number     │
       │         │  - buy_in_amount │              │  - selected_tees   │
       │         │  - status        │              │  - status          │
       │         └────────┬─────────┘              └────────────────────┘
       │                  │
       │                  │ 1:N    ┌──────────────────┐
       │                  ├────────│   match_scores   │
       │                  │        │  - hole_number   │
       │                  │        │  - strokes       │
       │                  │        └──────────────────┘
       │                  │
       │                  │ 1:1    ┌──────────────────┐
       │                  └────────│  match_results   │
       │                           │  - winners       │
       │                           │  - final_scores  │
       │                           └──────────────────┘
       │
       │ 1:N     ┌──────────────────┐
       └─────────│    user_roles    │
                 │  - role (enum)   │
                 └──────────────────┘
```

## Core Tables

### User Data

#### `profiles`
Public user profile information visible to other authenticated users.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| user_id | UUID | References auth.users |
| first_name | TEXT | User's first name |
| last_name | TEXT | User's last name |
| display_name | TEXT | Publicly shown name |
| handicap | NUMERIC | Golf handicap index |
| average_rating | NUMERIC | Average player rating |
| profile_picture_url | TEXT | Avatar URL |
| created_at | TIMESTAMPTZ | Record creation |
| updated_at | TIMESTAMPTZ | Last update |

#### `private_profile_data`
Sensitive user data with restricted access (user + admin only).

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| user_id | UUID | References auth.users |
| phone | TEXT | Phone number |
| date_of_birth | DATE | Birth date |
| membership_tier | TEXT | 'Free', 'Pro', 'disabled' |
| created_at | TIMESTAMPTZ | Record creation |
| updated_at | TIMESTAMPTZ | Last update |

#### `user_roles`
Role assignments for authorization.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| user_id | UUID | References auth.users |
| role | app_role | 'admin', 'moderator', 'user' |
| created_at | TIMESTAMPTZ | Record creation |

### Match Data

#### `matches`
Core match/competition records.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| created_by | UUID | Match creator user ID |
| course_name | TEXT | Golf course name |
| location | TEXT | Location description |
| address | TEXT | Full address |
| latitude | NUMERIC | GPS latitude |
| longitude | NUMERIC | GPS longitude |
| scheduled_time | TIMESTAMPTZ | Match start time |
| format | TEXT | 'stroke_play', 'match_play', 'best_ball', 'scramble' |
| holes | INTEGER | 9 or 18 |
| buy_in_amount | INTEGER | Entry fee in cents |
| max_participants | INTEGER | Maximum players |
| status | TEXT | 'open', 'started', 'completed', 'cancelled' |
| pin | TEXT | 4-digit join PIN |
| is_team_format | BOOLEAN | Team match flag |
| tee_selection_mode | TEXT | 'fixed', 'player_chooses' |
| default_tees | TEXT | Default tee selection |
| hole_pars | JSONB | Par for each hole |
| double_down_enabled | BOOLEAN | Double down feature flag |
| double_down_amount | INTEGER | Double down amount in cents |
| team2_pin, team3_pin, team4_pin | TEXT | Team-specific PINs |

#### `match_participants`
Players enrolled in matches.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| match_id | UUID | References matches |
| user_id | UUID | References auth.users |
| team_number | INTEGER | Team assignment (1-4) |
| selected_tees | TEXT | Player's tee selection |
| status | TEXT | 'active', 'left', 'completed', 'dnf' |
| joined_at | TIMESTAMPTZ | Join timestamp |

#### `match_scores`
Hole-by-hole scores.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| match_id | UUID | References matches |
| player_id | UUID | References auth.users |
| hole_number | INTEGER | 1-18 |
| strokes | INTEGER | Score for hole |
| created_at | TIMESTAMPTZ | Record creation |
| updated_at | TIMESTAMPTZ | Last update |

#### `match_results`
Final match outcomes.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| match_id | UUID | References matches (unique) |
| winner_id | UUID | Single winner (legacy) |
| winners | TEXT[] | Array of winner user IDs |
| final_scores | JSONB | `{ user_id: { gross, net, handicap } }` |
| forfeited_players | JSONB | List of forfeited players |
| completed_at | TIMESTAMPTZ | Match completion time |
| finalized_at | TIMESTAMPTZ | Results finalization time |
| finalized_by | UUID | Admin/user who finalized |

### Financial Data

#### `player_accounts`
User wallet balances.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| user_id | UUID | References auth.users |
| balance | NUMERIC | Balance in cents |
| created_at | TIMESTAMPTZ | Record creation |
| updated_at | TIMESTAMPTZ | Last update |

#### `account_transactions`
Financial transaction history.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| user_id | UUID | References auth.users |
| account_id | UUID | References player_accounts |
| amount | NUMERIC | Amount in cents (+credit, -debit) |
| transaction_type | transaction_type | Enum value |
| match_id | UUID | Related match (optional) |
| description | TEXT | Human-readable description |
| stripe_payment_intent_id | TEXT | Stripe reference |
| metadata | JSONB | Additional data |
| created_at | TIMESTAMPTZ | Transaction time |

```sql
-- Transaction types enum
CREATE TYPE transaction_type AS ENUM (
  'winning',           -- Prize money credited
  'match_buyin',       -- Entry fee charged
  'match_cancellation',-- Refund from cancelled match
  'subscription_charge',
  'coupon',           -- Promotional credit
  'payout',           -- Withdrawal to bank
  'double_down'       -- Double down wager
);
```

### Supporting Tables

| Table | Purpose |
|-------|---------|
| `golf_courses` | Course database with AI enrichment |
| `favorite_courses` | User's saved courses (max 5) |
| `player_ratings` | Post-match player ratings |
| `match_join_tokens` | Secure match join links |
| `pin_attempts` | PIN brute force tracking |
| `match_cancellation_confirmations` | Cancellation workflow |
| `match_cancellation_reviews` | Admin review queue |
| `incomplete_match_reviews` | Flagged incomplete matches |
| `double_down_participants` | Double down voting |
| `invites` | Invitation codes |
| `social_links` | Platform social media links |
| `admin_access_log` | Admin action audit |
| `profile_audit_log` | Profile change audit |

## Enums

```sql
-- User roles
CREATE TYPE app_role AS ENUM ('admin', 'moderator', 'user');

-- Financial transaction types
CREATE TYPE transaction_type AS ENUM (
  'winning', 'match_buyin', 'match_cancellation',
  'subscription_charge', 'coupon', 'payout', 'double_down'
);
```

## Key Functions

### Authorization

```sql
-- Check if user has a specific role
CREATE FUNCTION has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public;

-- Check if user is match creator
CREATE FUNCTION is_user_match_creator(p_match_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM matches
    WHERE id = p_match_id AND created_by = p_user_id
  );
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public;

-- Check if user is match participant
CREATE FUNCTION is_user_match_participant(p_match_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM match_participants
    WHERE match_id = p_match_id AND user_id = p_user_id
  );
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public;
```

### Match Operations

```sql
-- Validate PIN and join match
CREATE FUNCTION validate_and_join_match(
  p_match_id UUID,
  p_pin TEXT DEFAULT NULL,
  p_team_number INTEGER DEFAULT NULL,
  p_set_team_pin TEXT DEFAULT NULL
) RETURNS JSON;

-- Start a match
CREATE FUNCTION start_match(match_id UUID) RETURNS BOOLEAN;

-- Finalize match results and distribute prizes
CREATE FUNCTION finalize_match_results(p_match_id UUID) RETURNS BOOLEAN;

-- Leave match with DNF status
CREATE FUNCTION leave_match_with_dnf(
  p_match_id UUID,
  p_user_id UUID,
  p_reason TEXT
) RETURNS JSON;
```

### Scheduled Jobs

```sql
-- Flag incomplete matches (runs hourly via pg_cron)
CREATE FUNCTION flag_incomplete_matches() RETURNS INTEGER;

-- Clean up expired join tokens
CREATE FUNCTION cleanup_expired_join_tokens() RETURNS INTEGER;

-- Clean up temporary media files
CREATE FUNCTION cleanup_old_temp_media() RETURNS INTEGER;
```

## Row Level Security (RLS)

All tables have RLS enabled. Policy patterns:

### Owner-Only Access
```sql
CREATE POLICY "Users can view own data"
ON private_profile_data FOR SELECT
USING (user_id = auth.uid());
```

### Participant Access
```sql
CREATE POLICY "Participants can view scores"
ON match_scores FOR SELECT
USING (EXISTS (
  SELECT 1 FROM match_participants mp
  WHERE mp.match_id = match_scores.match_id
  AND mp.user_id = auth.uid()
));
```

### Admin Access
```sql
CREATE POLICY "Admins can update matches"
ON matches FOR UPDATE
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));
```

### Public Read
```sql
CREATE POLICY "Anyone can view open matches"
ON matches FOR SELECT
USING (status = 'open' OR created_by = auth.uid() OR ...);
```

## Triggers

### Automatic Timestamps
```sql
CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON profiles
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
```

### Validation Triggers
```sql
-- Validate handicap range (-10 to 54)
CREATE TRIGGER validate_handicap_trigger
BEFORE INSERT OR UPDATE ON profiles
FOR EACH ROW
EXECUTE FUNCTION validate_handicap();

-- Validate score range (1-20 per hole)
CREATE TRIGGER validate_score_trigger
BEFORE INSERT OR UPDATE ON match_scores
FOR EACH ROW
EXECUTE FUNCTION validate_score();
```

### Audit Logging
```sql
-- Log profile changes
CREATE TRIGGER log_profile_changes
AFTER UPDATE ON profiles
FOR EACH ROW
EXECUTE FUNCTION log_profile_update();
```

## Indexes

Key indexes for query performance:

```sql
-- Match lookups
CREATE INDEX idx_matches_status ON matches(status);
CREATE INDEX idx_matches_scheduled_time ON matches(scheduled_time);
CREATE INDEX idx_matches_created_by ON matches(created_by);

-- Participant lookups
CREATE INDEX idx_match_participants_user_id ON match_participants(user_id);
CREATE INDEX idx_match_participants_match_id ON match_participants(match_id);

-- Score lookups
CREATE INDEX idx_match_scores_match_player ON match_scores(match_id, player_id);

-- Geospatial queries
CREATE INDEX idx_matches_location ON matches(latitude, longitude);
CREATE INDEX idx_golf_courses_location ON golf_courses(latitude, longitude);
```

## Migrations

Migrations are managed through Supabase and stored in `supabase/migrations/`. 

**Important**: The `supabase/migrations/` folder is read-only in Lovable. Create migrations via:
1. Supabase Dashboard SQL Editor
2. Lovable migration tool
3. Local Supabase CLI

Types are auto-generated to `src/integrations/supabase/types.ts` after migrations.
