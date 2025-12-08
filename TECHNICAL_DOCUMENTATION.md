# MatchPlay Technical Documentation

## Overview

MatchPlay is a competitive golf platform that facilitates skill-based golf competitions with entry fees and prize distribution. This document details the technical implementation, algorithms, and system architecture.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Database Schema](#database-schema)
3. [Authentication & Authorization](#authentication--authorization)
4. [Handicap Calculation System](#handicap-calculation-system)
5. [Match Management](#match-management)
6. [Scoring System](#scoring-system)
7. [Payment Processing](#payment-processing)
8. [Prize Distribution Algorithm](#prize-distribution-algorithm)
9. [Security Implementation](#security-implementation)
10. [Real-Time Features](#real-time-features)
11. [Edge Functions](#edge-functions)

---

## 1. Architecture Overview

### Technology Stack

- **Frontend**: React 18, TypeScript, Vite
- **UI Framework**: Tailwind CSS, shadcn/ui components
- **Backend**: Supabase (PostgreSQL, Edge Functions, Auth)
- **Payments**: Stripe Connect
- **State Management**: TanStack Query (React Query)
- **Routing**: React Router v6

### System Flow

```
User Interface (React)
        ↓
   Supabase Client
        ↓
┌───────────────────────────────────────┐
│           Supabase Backend            │
│  ┌─────────────────────────────────┐  │
│  │   PostgreSQL Database           │  │
│  │   - Row Level Security (RLS)    │  │
│  │   - Triggers & Functions        │  │
│  └─────────────────────────────────┘  │
│  ┌─────────────────────────────────┐  │
│  │   Edge Functions (Deno)         │  │
│  │   - Payment processing          │  │
│  │   - Course enrichment           │  │
│  │   - Admin operations            │  │
│  └─────────────────────────────────┘  │
│  ┌─────────────────────────────────┐  │
│  │   Supabase Auth                 │  │
│  │   - Email/Password              │  │
│  │   - MFA Support                 │  │
│  └─────────────────────────────────┘  │
└───────────────────────────────────────┘
        ↓
   Stripe API (Payments)
```

---

## 2. Database Schema

### Core Tables

#### `profiles`
Stores public user profile information.

```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY,
  user_id UUID UNIQUE NOT NULL,
  first_name TEXT,
  last_name TEXT,
  display_name TEXT,
  handicap NUMERIC,
  average_rating NUMERIC,
  profile_picture_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

#### `private_profile_data`
Stores sensitive user data with restricted access.

```sql
CREATE TABLE private_profile_data (
  id UUID PRIMARY KEY,
  user_id UUID UNIQUE NOT NULL,
  phone TEXT,
  date_of_birth DATE,
  membership_tier TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

#### `matches`
Core match/competition records.

```sql
CREATE TABLE matches (
  id UUID PRIMARY KEY,
  created_by UUID NOT NULL,
  course_name TEXT NOT NULL,
  location TEXT NOT NULL,
  address TEXT,
  latitude NUMERIC,
  longitude NUMERIC,
  scheduled_time TIMESTAMPTZ NOT NULL,
  format TEXT NOT NULL, -- 'stroke_play', 'match_play', 'best_ball', 'scramble'
  holes INTEGER DEFAULT 18,
  buy_in_amount INTEGER DEFAULT 0, -- in cents
  max_participants INTEGER DEFAULT 4,
  status TEXT DEFAULT 'open', -- 'open', 'started', 'completed', 'cancelled'
  pin TEXT, -- 4-digit PIN for joining
  is_team_format BOOLEAN DEFAULT false,
  tee_selection_mode TEXT DEFAULT 'creator_chooses',
  default_tees TEXT,
  hole_pars JSONB,
  double_down_enabled BOOLEAN DEFAULT false,
  double_down_amount INTEGER,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

#### `match_participants`
Tracks players in each match.

```sql
CREATE TABLE match_participants (
  id UUID PRIMARY KEY,
  match_id UUID REFERENCES matches(id),
  user_id UUID NOT NULL,
  team_number INTEGER,
  selected_tees TEXT,
  status TEXT DEFAULT 'active', -- 'active', 'left', 'completed'
  joined_at TIMESTAMPTZ DEFAULT now()
);
```

#### `match_scores`
Individual hole scores.

```sql
CREATE TABLE match_scores (
  id UUID PRIMARY KEY,
  match_id UUID NOT NULL,
  player_id UUID NOT NULL,
  hole_number INTEGER NOT NULL,
  strokes INTEGER,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

#### `match_results`
Final match outcomes.

```sql
CREATE TABLE match_results (
  id UUID PRIMARY KEY,
  match_id UUID UNIQUE REFERENCES matches(id),
  winner_id UUID,
  winners TEXT[], -- array of winner user IDs (for ties)
  final_scores JSONB, -- { user_id: { gross, net, handicap } }
  forfeited_players JSONB,
  completed_at TIMESTAMPTZ,
  finalized_at TIMESTAMPTZ,
  finalized_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

#### `player_accounts`
Financial account balances.

```sql
CREATE TABLE player_accounts (
  id UUID PRIMARY KEY,
  user_id UUID UNIQUE NOT NULL,
  balance INTEGER DEFAULT 0, -- in cents
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

#### `account_transactions`
Transaction history for all financial movements.

```sql
CREATE TABLE account_transactions (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  account_id UUID REFERENCES player_accounts(id),
  amount INTEGER NOT NULL, -- in cents (positive = credit, negative = debit)
  transaction_type transaction_type NOT NULL,
  match_id UUID REFERENCES matches(id),
  description TEXT NOT NULL,
  stripe_payment_intent_id TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Transaction types enum
CREATE TYPE transaction_type AS ENUM (
  'winning',
  'match_buyin',
  'match_cancellation',
  'subscription_charge',
  'coupon',
  'payout',
  'double_down'
);
```

---

## 3. Authentication & Authorization

### Authentication Flow

1. **Email/Password Registration**
   - User submits email and password
   - Supabase Auth creates user in `auth.users`
   - Trigger creates corresponding `profiles` and `private_profile_data` records
   - Email verification sent

2. **MFA (Multi-Factor Authentication)**
   - Optional TOTP-based MFA enrollment
   - Stored in Supabase Auth AAL (Authentication Assurance Level)

### Role-Based Access Control

```sql
-- User roles enum
CREATE TYPE app_role AS ENUM ('admin', 'moderator', 'user');

-- Role assignment table
CREATE TABLE user_roles (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Helper function to check roles
CREATE FUNCTION has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$ LANGUAGE sql SECURITY DEFINER;
```

### Row Level Security (RLS)

All tables have RLS enabled with policies based on:
- User ownership (`user_id = auth.uid()`)
- Match participation
- Admin role checks

Example policy:
```sql
-- Users can only view their own transactions
CREATE POLICY "Users can view own transactions"
ON account_transactions FOR SELECT
USING (user_id = auth.uid());

-- Users can view profiles of match participants
CREATE POLICY "View match participant profiles"
ON profiles FOR SELECT
USING (
  user_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM match_participants mp1
    JOIN match_participants mp2 ON mp1.match_id = mp2.match_id
    WHERE mp1.user_id = auth.uid() AND mp2.user_id = profiles.user_id
  )
);
```

---

## 4. Handicap Calculation System

### Overview

MatchPlay implements a USGA-compliant handicap index calculation with enhanced accuracy due to verified competitive scoring.

### Algorithm

#### Step 1: Course Handicap Calculation

```typescript
// Calculate course handicap from handicap index
function calculateCourseHandicap(
  handicapIndex: number,
  slopeRating: number,
  courseRating: number,
  par: number
): number {
  // USGA Formula: Course Handicap = Handicap Index × (Slope Rating / 113) + (Course Rating - Par)
  const courseHandicap = handicapIndex * (slopeRating / 113) + (courseRating - par);
  return Math.round(courseHandicap);
}
```

#### Step 2: Score Differential Calculation

```typescript
function calculateScoreDifferential(
  adjustedGrossScore: number,
  courseRating: number,
  slopeRating: number,
  parPlayed: number // PCC adjustment if applicable
): number {
  // Score Differential = (113 / Slope Rating) × (Adjusted Gross Score - Course Rating - PCC)
  return (113 / slopeRating) * (adjustedGrossScore - courseRating - parPlayed);
}
```

#### Step 3: Handicap Index Calculation

```typescript
function calculateHandicapIndex(scoreDifferentials: number[]): number {
  // Sort differentials ascending
  const sorted = [...scoreDifferentials].sort((a, b) => a - b);
  
  // Determine how many differentials to use based on USGA table
  const count = sorted.length;
  let usedCount: number;
  let adjustment: number = 0;
  
  if (count < 5) {
    // Not enough rounds for official handicap
    return null;
  } else if (count <= 6) {
    usedCount = 1;
    adjustment = -2.0;
  } else if (count <= 8) {
    usedCount = 2;
    adjustment = -1.0;
  } else if (count <= 11) {
    usedCount = 3;
    adjustment = 0;
  } else if (count <= 14) {
    usedCount = 4;
    adjustment = 0;
  } else if (count <= 16) {
    usedCount = 5;
    adjustment = 0;
  } else if (count <= 18) {
    usedCount = 6;
    adjustment = 0;
  } else if (count === 19) {
    usedCount = 7;
    adjustment = 0;
  } else {
    usedCount = 8; // 20+ rounds
    adjustment = 0;
  }
  
  // Take lowest differentials
  const lowestDifferentials = sorted.slice(0, usedCount);
  
  // Calculate average
  const average = lowestDifferentials.reduce((sum, d) => sum + d, 0) / usedCount;
  
  // Apply 96% factor and adjustment
  const handicapIndex = (average * 0.96) + adjustment;
  
  // Cap at 54.0
  return Math.min(Math.round(handicapIndex * 10) / 10, 54.0);
}
```

#### Step 4: Net Double Bogey Adjustment

```typescript
function applyNetDoubleBogeyAdjustment(
  strokes: number,
  par: number,
  courseHandicap: number,
  holeHandicapRating: number // 1-18, where 1 is hardest
): number {
  // Calculate strokes received on this hole
  const strokesReceived = Math.floor(courseHandicap / 18) + 
    (holeHandicapRating <= (courseHandicap % 18) ? 1 : 0);
  
  // Net Double Bogey = Par + 2 + Strokes Received
  const maxScore = par + 2 + strokesReceived;
  
  return Math.min(strokes, maxScore);
}
```

### Implementation in Hook

```typescript
// src/hooks/useHandicapCalculation.tsx
export function useHandicapCalculation() {
  const { user } = useAuth();
  const [completedMatches, setCompletedMatches] = useState<MatchScore[]>([]);
  
  const calculateHandicapIndex = useCallback(() => {
    if (completedMatches.length < 5) return null;
    
    // Calculate score differentials for each round
    const differentials = completedMatches.map(match => {
      const adjustedScore = match.holeScores.reduce((total, hole) => {
        return total + applyNetDoubleBogeyAdjustment(
          hole.strokes,
          hole.par,
          match.courseHandicap,
          hole.handicapRating
        );
      }, 0);
      
      return calculateScoreDifferential(
        adjustedScore,
        match.courseRating,
        match.slopeRating,
        0 // PCC adjustment
      );
    });
    
    return calculateHandicapIndex(differentials);
  }, [completedMatches]);
  
  return { calculateHandicapIndex, completedMatches };
}
```

---

## 5. Match Management

### Match Lifecycle

```
┌─────────┐    create    ┌──────┐    start    ┌─────────┐    finalize    ┌───────────┐
│  None   │ ──────────▶  │ Open │ ──────────▶ │ Started │ ─────────────▶ │ Completed │
└─────────┘              └──────┘             └─────────┘                └───────────┘
                              │                    │
                              │ cancel             │ cancel/timeout
                              ▼                    ▼
                         ┌───────────┐       ┌───────────┐
                         │ Cancelled │       │ Cancelled │
                         └───────────┘       └───────────┘
```

### Match Creation

```typescript
// Validation rules
const matchValidation = {
  buy_in_amount: { min: 0, max: 50000 }, // $0 - $500
  max_participants: { min: 1, max: 16 },
  handicap_min: { min: -10, max: 54 },
  handicap_max: { min: -10, max: 54 },
  holes: [9, 18],
  formats: ['stroke_play', 'match_play', 'best_ball', 'scramble']
};
```

### Join Match Flow

1. **PIN Verification** (if required)
   ```sql
   CREATE FUNCTION validate_and_join_match(
     p_match_id UUID,
     p_pin TEXT DEFAULT NULL,
     p_team_number INTEGER DEFAULT NULL
   ) RETURNS JSON AS $$
   DECLARE
     v_match matches%ROWTYPE;
     v_user_id UUID := auth.uid();
   BEGIN
     -- Get match details
     SELECT * INTO v_match FROM matches WHERE id = p_match_id;
     
     -- Check if match exists and is open
     IF v_match IS NULL THEN
       RETURN json_build_object('success', false, 'error', 'Match not found');
     END IF;
     
     IF v_match.status != 'open' THEN
       RETURN json_build_object('success', false, 'error', 'Match is not open');
     END IF;
     
     -- Verify PIN if required
     IF v_match.pin IS NOT NULL AND v_match.pin != p_pin THEN
       RETURN json_build_object('success', false, 'error', 'Invalid PIN');
     END IF;
     
     -- Check participant limit
     IF (SELECT COUNT(*) FROM match_participants WHERE match_id = p_match_id AND status = 'active') >= v_match.max_participants THEN
       RETURN json_build_object('success', false, 'error', 'Match is full');
     END IF;
     
     -- Add participant
     INSERT INTO match_participants (match_id, user_id, team_number)
     VALUES (p_match_id, v_user_id, p_team_number);
     
     RETURN json_build_object('success', true);
   END;
   $$ LANGUAGE plpgsql SECURITY DEFINER;
   ```

2. **Secure Token Links**
   - Alternative to PINs for invitations
   - Tokens stored in `match_join_tokens` table
   - Expire after 24 hours or single use

### Automatic Cleanup

```sql
-- Trigger to clean up participants when match is cancelled
CREATE FUNCTION cleanup_orphaned_participants()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'cancelled' AND OLD.status != 'cancelled' THEN
    UPDATE match_participants
    SET status = 'left'
    WHERE match_id = NEW.id AND status = 'active';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_cleanup_orphaned_participants
  AFTER UPDATE OF status ON matches
  FOR EACH ROW
  EXECUTE FUNCTION cleanup_orphaned_participants();
```

### Incomplete Match Handling

```sql
-- Cron job runs hourly to flag incomplete matches
CREATE FUNCTION flag_incomplete_matches()
RETURNS INTEGER AS $$
DECLARE
  flagged_count INTEGER := 0;
BEGIN
  -- Flag matches started > 24 hours ago without results
  INSERT INTO incomplete_match_reviews (match_id, match_started_at, incomplete_players, completed_players)
  SELECT 
    m.id,
    m.updated_at,
    (SELECT json_agg(mp.user_id) FROM match_participants mp 
     LEFT JOIN match_scores ms ON ms.match_id = m.id AND ms.player_id = mp.user_id
     WHERE mp.match_id = m.id AND mp.status = 'active'
     GROUP BY mp.user_id HAVING COUNT(DISTINCT ms.hole_number) < m.holes),
    (SELECT json_agg(mp.user_id) FROM match_participants mp 
     LEFT JOIN match_scores ms ON ms.match_id = m.id AND ms.player_id = mp.user_id  
     WHERE mp.match_id = m.id AND mp.status = 'active'
     GROUP BY mp.user_id HAVING COUNT(DISTINCT ms.hole_number) = m.holes)
  FROM matches m
  WHERE m.status = 'started'
    AND m.updated_at < NOW() - INTERVAL '24 hours'
    AND NOT EXISTS (SELECT 1 FROM match_results mr WHERE mr.match_id = m.id AND mr.finalized_at IS NOT NULL)
    AND NOT EXISTS (SELECT 1 FROM incomplete_match_reviews imr WHERE imr.match_id = m.id);
    
  GET DIAGNOSTICS flagged_count = ROW_COUNT;
  RETURN flagged_count;
END;
$$ LANGUAGE plpgsql;
```

---

## 6. Scoring System

### Real-Time Score Entry

```typescript
// src/hooks/useMatchScoring.tsx
export function useMatchScoring(matchId: string) {
  const [scores, setScores] = useState<Record<string, number[]>>({});
  
  // Subscribe to real-time score updates
  useEffect(() => {
    const channel = supabase
      .channel(`match-scores-${matchId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'match_scores',
        filter: `match_id=eq.${matchId}`
      }, (payload) => {
        // Update local state
        handleScoreUpdate(payload);
      })
      .subscribe();
      
    return () => {
      supabase.removeChannel(channel);
    };
  }, [matchId]);
  
  const updateScore = async (playerId: string, holeNumber: number, strokes: number) => {
    const { error } = await supabase
      .from('match_scores')
      .upsert({
        match_id: matchId,
        player_id: playerId,
        hole_number: holeNumber,
        strokes
      }, {
        onConflict: 'match_id,player_id,hole_number'
      });
      
    if (error) throw error;
  };
  
  return { scores, updateScore };
}
```

### Offline Score Sync

```typescript
// src/lib/offlineDb.ts
import { openDB } from 'idb';

const dbPromise = openDB('matchplay-offline', 1, {
  upgrade(db) {
    db.createObjectStore('pending-scores', { keyPath: 'id', autoIncrement: true });
  }
});

export async function savePendingScore(score: PendingScore) {
  const db = await dbPromise;
  await db.add('pending-scores', { ...score, timestamp: Date.now() });
}

export async function syncPendingScores() {
  const db = await dbPromise;
  const pending = await db.getAll('pending-scores');
  
  for (const score of pending) {
    try {
      await supabase.from('match_scores').upsert(score);
      await db.delete('pending-scores', score.id);
    } catch (error) {
      console.error('Failed to sync score:', error);
    }
  }
}
```

### Net Score Calculation

```typescript
function calculateNetScore(
  grossScore: number,
  courseHandicap: number,
  holes: number
): number {
  // For stroke play: Net Score = Gross Score - Course Handicap
  return grossScore - courseHandicap;
}

function calculateTeamNetScore(
  players: Player[],
  format: 'best_ball' | 'scramble'
): number {
  if (format === 'best_ball') {
    // Best Ball: Use lowest net score on each hole
    const holeScores = [];
    for (let hole = 1; hole <= 18; hole++) {
      const lowestNet = Math.min(
        ...players.map(p => p.holeScores[hole] - p.strokesReceivedOnHole(hole))
      );
      holeScores.push(lowestNet);
    }
    return holeScores.reduce((a, b) => a + b, 0);
  } else {
    // Scramble: Team plays best shot, use combined handicap percentage
    const teamHandicap = Math.round(
      players.reduce((sum, p) => sum + p.courseHandicap, 0) * 0.25
    );
    return grossScore - teamHandicap;
  }
}
```

---

## 7. Payment Processing

### Stripe Integration

#### Entry Fee Collection

```typescript
// supabase/functions/charge-match-buyin/index.ts
serve(async (req) => {
  const { matchId, userId } = await req.json();
  
  // Get match and user details
  const { data: match } = await supabase
    .from('matches')
    .select('buy_in_amount')
    .eq('id', matchId)
    .single();
    
  const { data: profile } = await supabase
    .from('private_profile_data')
    .select('stripe_customer_id')
    .eq('user_id', userId)
    .single();
    
  // Create payment intent
  const paymentIntent = await stripe.paymentIntents.create({
    amount: match.buy_in_amount,
    currency: 'usd',
    customer: profile.stripe_customer_id,
    payment_method_types: ['card'],
    metadata: {
      match_id: matchId,
      user_id: userId,
      type: 'match_buyin'
    }
  });
  
  // Record transaction
  await supabase.from('account_transactions').insert({
    user_id: userId,
    amount: -match.buy_in_amount,
    transaction_type: 'match_buyin',
    match_id: matchId,
    description: `Entry fee for match`,
    stripe_payment_intent_id: paymentIntent.id
  });
  
  return new Response(JSON.stringify({ clientSecret: paymentIntent.client_secret }));
});
```

#### Payout Processing

```typescript
// supabase/functions/process-payout/index.ts
serve(async (req) => {
  const { userId, amount } = await req.json();
  
  // Get user's connected account
  const { data: account } = await supabase
    .from('player_accounts')
    .select('*, profiles!inner(stripe_connect_id)')
    .eq('user_id', userId)
    .single();
    
  // Verify sufficient balance
  if (account.balance < amount) {
    throw new Error('Insufficient balance');
  }
  
  // Create transfer to connected account
  const transfer = await stripe.transfers.create({
    amount,
    currency: 'usd',
    destination: account.profiles.stripe_connect_id,
    metadata: {
      user_id: userId,
      type: 'payout'
    }
  });
  
  // Update balance and record transaction
  await supabase.rpc('process_payout_transaction', {
    p_user_id: userId,
    p_amount: amount,
    p_transfer_id: transfer.id
  });
  
  return new Response(JSON.stringify({ success: true }));
});
```

---

## 8. Prize Distribution Algorithm

### Distribution Rules

```typescript
interface PrizeDistribution {
  [placement: number]: number; // percentage of pot
}

const DISTRIBUTION_RULES: Record<number, PrizeDistribution> = {
  2: { 1: 100 },                           // 2 players: winner takes all
  3: { 1: 70, 2: 30 },                     // 3 players: 70/30 split
  4: { 1: 60, 2: 30, 3: 10 },              // 4 players: 60/30/10
  5: { 1: 55, 2: 25, 3: 15, 4: 5 },        // 5+ players
  6: { 1: 50, 2: 25, 3: 15, 4: 10 },
  // ... etc
};

function calculatePrizeDistribution(
  totalPot: number,
  playerCount: number,
  finalStandings: PlayerStanding[]
): PrizePayment[] {
  const rules = DISTRIBUTION_RULES[Math.min(playerCount, 6)];
  const payments: PrizePayment[] = [];
  
  // Handle ties by splitting prize money
  const groupedByScore = groupBy(finalStandings, 'netScore');
  let currentPlacement = 1;
  
  for (const [score, players] of Object.entries(groupedByScore)) {
    const placementsForGroup = [];
    for (let i = 0; i < players.length; i++) {
      placementsForGroup.push(currentPlacement + i);
    }
    
    // Calculate combined prize for tied positions
    const combinedPrize = placementsForGroup.reduce((sum, placement) => {
      return sum + (rules[placement] || 0);
    }, 0);
    
    // Split equally among tied players
    const prizePerPlayer = Math.floor((combinedPrize / 100 * totalPot) / players.length);
    
    for (const player of players) {
      if (prizePerPlayer > 0) {
        payments.push({
          userId: player.userId,
          amount: prizePerPlayer,
          placement: currentPlacement
        });
      }
    }
    
    currentPlacement += players.length;
  }
  
  return payments;
}
```

### Match Finalization

```sql
CREATE FUNCTION finalize_match_results(p_match_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_match matches%ROWTYPE;
  v_participants RECORD;
  v_total_pot INTEGER;
  v_winner_id UUID;
BEGIN
  -- Get match
  SELECT * INTO v_match FROM matches WHERE id = p_match_id;
  
  -- Calculate total pot
  v_total_pot := v_match.buy_in_amount * (
    SELECT COUNT(*) FROM match_participants 
    WHERE match_id = p_match_id AND status = 'active'
  );
  
  -- Get final standings (ordered by net score)
  FOR v_participants IN (
    SELECT 
      mp.user_id,
      SUM(ms.strokes) as gross_score,
      SUM(ms.strokes) - p.handicap as net_score,
      ROW_NUMBER() OVER (ORDER BY SUM(ms.strokes) - p.handicap ASC) as placement
    FROM match_participants mp
    JOIN match_scores ms ON ms.match_id = mp.match_id AND ms.player_id = mp.user_id
    JOIN profiles p ON p.user_id = mp.user_id
    WHERE mp.match_id = p_match_id AND mp.status = 'active'
    GROUP BY mp.user_id, p.handicap
    ORDER BY net_score ASC
  ) LOOP
    -- Process prize for each placement
    -- (Actual distribution logic in edge function)
  END LOOP;
  
  -- Update match status
  UPDATE matches SET status = 'completed' WHERE id = p_match_id;
  
  -- Create/update match result
  INSERT INTO match_results (match_id, winner_id, completed_at, finalized_at, finalized_by)
  VALUES (p_match_id, v_winner_id, NOW(), NOW(), auth.uid())
  ON CONFLICT (match_id) DO UPDATE
  SET winner_id = v_winner_id, finalized_at = NOW(), finalized_by = auth.uid();
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## 9. Security Implementation

### Row Level Security Policies

```sql
-- Profiles: Public read, owner write
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profiles viewable by authenticated users"
ON profiles FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Users can update own profile"
ON profiles FOR UPDATE
TO authenticated
USING (user_id = auth.uid());

-- Private data: Owner only
ALTER TABLE private_profile_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only access own private data"
ON private_profile_data FOR ALL
TO authenticated
USING (user_id = auth.uid());

-- Account transactions: Owner + Admin
ALTER TABLE account_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own transactions"
ON account_transactions FOR SELECT
TO authenticated
USING (
  user_id = auth.uid() OR
  has_role(auth.uid(), 'admin')
);
```

### Input Validation

```sql
CREATE FUNCTION sanitize_text_input(input_text TEXT)
RETURNS TEXT AS $$
BEGIN
  -- Remove potential XSS vectors
  RETURN regexp_replace(
    regexp_replace(input_text, '<[^>]*>', '', 'g'),
    '[^\w\s\-\.\,\!\?\@\#\$\%\&\*\(\)]',
    '',
    'g'
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;
```

### Audit Logging

```sql
CREATE TABLE admin_access_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID NOT NULL,
  action TEXT NOT NULL,
  accessed_table TEXT NOT NULL,
  accessed_user_id UUID,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE FUNCTION log_admin_action()
RETURNS TRIGGER AS $$
BEGIN
  IF has_role(auth.uid(), 'admin') THEN
    INSERT INTO admin_access_log (admin_user_id, action, accessed_table, metadata)
    VALUES (auth.uid(), TG_OP, TG_TABLE_NAME, row_to_json(NEW));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## 10. Real-Time Features

### Supabase Realtime Subscriptions

```typescript
// Score updates
const scoresChannel = supabase
  .channel('match-scores')
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'match_scores',
    filter: `match_id=eq.${matchId}`
  }, handleScoreUpdate)
  .subscribe();

// Transaction updates
const transactionsChannel = supabase
  .channel('account-transactions')
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'account_transactions',
    filter: `user_id=eq.${userId}`
  }, handleNewTransaction)
  .subscribe();

// Match status updates
const matchChannel = supabase
  .channel('match-status')
  .on('postgres_changes', {
    event: 'UPDATE',
    schema: 'public',
    table: 'matches',
    filter: `id=eq.${matchId}`
  }, handleMatchUpdate)
  .subscribe();
```

### PWA & Offline Support

```typescript
// vite.config.ts - PWA configuration
VitePWA({
  registerType: 'autoUpdate',
  workbox: {
    globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
    runtimeCaching: [
      {
        urlPattern: /^https:\/\/rgdegvpfnilzkqpexgij\.supabase\.co\/rest\/v1\/.*/,
        handler: 'NetworkFirst',
        options: {
          cacheName: 'supabase-api',
          expiration: { maxEntries: 100, maxAgeSeconds: 300 }
        }
      }
    ]
  }
})
```

---

## 11. Edge Functions

### Available Functions

| Function | Purpose | Auth Required |
|----------|---------|---------------|
| `charge-match-buyin` | Process entry fee payment | Yes |
| `credit-match-winnings` | Distribute prizes | Yes (Admin) |
| `process-payout` | Handle withdrawal requests | Yes |
| `create-checkout` | Stripe checkout session | Yes |
| `customer-portal` | Stripe billing portal | Yes |
| `check-subscription` | Verify subscription status | Yes |
| `enrich-golf-course` | AI course data enhancement | Yes (Admin) |
| `smart-course-search` | Natural language course search | Yes (Paid) |
| `recommend-courses` | Personalized recommendations | Yes |
| `flag-incomplete-matches` | Auto-flag stale matches | Cron |
| `admin-list-users` | User management | Yes (Admin) |
| `admin-disable-user` | Account suspension | Yes (Admin) |

### Edge Function Structure

```typescript
// Standard edge function template
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@13.11.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Create authenticated Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Verify auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    // Function logic here...

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
```

---

## Appendix: Environment Variables

### Required Secrets (Edge Functions)

- `STRIPE_SECRET_KEY` - Stripe API key
- `STRIPE_WEBHOOK_SECRET` - Stripe webhook signing secret
- `OPENAI_API_KEY` - OpenAI API for course enrichment
- `GOLFCOURSEAPI_KEY` - Golf course data API
- `AYRSHARE_API_KEY` - Social media integration

### Client Configuration

```typescript
// src/integrations/supabase/client.ts
export const supabase = createClient(
  'https://rgdegvpfnilzkqpexgij.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' // anon key
);
```

---

*Document Version: 1.0*  
*Last Updated: December 2024*
