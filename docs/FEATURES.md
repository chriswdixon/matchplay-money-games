# Feature Documentation

## Core Features

### Match Management

#### Match Creation
Users can create competitive golf matches with configurable parameters:

```typescript
// Match creation parameters
interface MatchConfig {
  course_name: string;          // Required
  location: string;             // City/State
  address?: string;             // Full address
  scheduled_time: Date;         // Match start time
  format: 'stroke_play' | 'match_play' | 'best_ball' | 'scramble';
  holes: 9 | 18;
  buy_in_amount: number;        // 0-500 dollars
  max_participants: number;     // 1-16 players
  handicap_min?: number;        // -10 to 54
  handicap_max?: number;        // -10 to 54
  tee_selection_mode: 'fixed' | 'player_chooses';
  default_tees?: string;
  is_team_format: boolean;
  double_down_enabled: boolean;
}
```

**Validation Rules:**
- Buy-in: $0-$500
- Handicap: -10 to 54
- Users cannot create new matches if they have incomplete matches

**Form Persistence:**
- Form state saved to localStorage (debounced 500ms)
- Restored on page reload
- Cleared on successful submission or cancellation

#### Match Formats

| Format | Players | Description |
|--------|---------|-------------|
| Stroke Play | 2-4 | Individual, lowest total strokes wins |
| Match Play | 2 | Head-to-head, most holes won |
| Best Ball | 4 (2v2) | Team, best score per hole counts |
| Scramble | 4 (2v2) | Team, all play from best shot |

#### Match Lifecycle

```
┌────────┐
│  Open  │ ← Match created, accepting players
└────┬───┘
     │ start_match() - all players joined
     ▼
┌─────────┐
│ Started │ ← Scoring in progress
└────┬────┘
     │
     ├──► finalize_match_results() ──► ┌───────────┐
     │                                 │ Completed │
     │                                 └───────────┘
     │
     └──► cancel_match() ──► ┌───────────┐
                             │ Cancelled │
                             └───────────┘
```

#### Match Joining

**PIN-Based Joining:**
```typescript
// validate_and_join_match() function
// 1. Verify match is open
// 2. Check PIN if required
// 3. Verify handicap eligibility
// 4. Check participant limit
// 5. Add to match_participants
// 6. Charge entry fee if applicable
```

**Secure Token Links:**
- Generate time-limited join URLs
- Bypass PIN for trusted invites
- Auto-assign to specific team

**Rate Limiting:**
- Max 5 PIN attempts per 15 minutes
- Progressive delay after failures

### Scoring System

#### Real-Time Score Entry
```typescript
// MatchScorecard component
const { scores, updateScore, syncPendingScores } = useMatchScoring(matchId);

// Score entry with optimistic updates
const handleScoreChange = async (holeNumber: number, strokes: number) => {
  // 1. Validate (1-20 strokes)
  // 2. Optimistic UI update
  // 3. Upsert to match_scores
  // 4. Real-time broadcast to other players
  // 5. IndexedDB backup for offline
};
```

#### Offline Support
```typescript
// IndexedDB for offline scores
const db = await openDB('matchplay-offline', 1, {
  upgrade(db) {
    db.createObjectStore('pending-scores', { keyPath: 'id' });
  }
});

// Store pending score
await db.put('pending-scores', {
  id: `${matchId}-${holeNumber}`,
  matchId,
  playerId: user.id,
  holeNumber,
  strokes,
  timestamp: Date.now()
});

// Sync when online
const syncPendingScores = async () => {
  const pending = await db.getAll('pending-scores');
  for (const score of pending) {
    await supabase.from('match_scores').upsert(score);
    await db.delete('pending-scores', score.id);
  }
};
```

#### Score Calculations

**Net Score (Handicap Adjusted):**
```typescript
function calculateNetScore(
  grossScore: number,
  courseHandicap: number,
  holes: number
): number {
  const strokesPerHole = courseHandicap / holes;
  return grossScore - Math.round(strokesPerHole * holes);
}
```

**Team Net Score (Best Ball):**
```typescript
function calculateTeamNetScore(
  team: Player[],
  holeNumber: number,
  holePar: number
): number {
  const netScores = team.map(player => {
    const strokesReceived = getStrokesReceivedOnHole(
      player.courseHandicap,
      holeNumber
    );
    return player.strokes - strokesReceived;
  });
  return Math.min(...netScores);
}
```

### Handicap System

USGA-compliant handicap calculation:

```typescript
// useHandicapCalculation hook
function calculateHandicapIndex(scoreDifferentials: number[]): number | null {
  if (scoreDifferentials.length < 5) return null;
  
  const sorted = [...scoreDifferentials].sort((a, b) => a - b);
  const count = sorted.length;
  
  // USGA lookup table for how many differentials to use
  const usedCount = getUsedDifferentialCount(count);
  const adjustment = getAdjustment(count);
  
  const lowestDifferentials = sorted.slice(0, usedCount);
  const average = lowestDifferentials.reduce((sum, d) => sum + d, 0) / usedCount;
  
  // Apply 96% factor and cap at 54.0
  return Math.min((average * 0.96) + adjustment, 54.0);
}
```

### Payment System

#### Entry Fee Collection
```typescript
// charge-match-buyin edge function
// 1. Check player balance
// 2. If sufficient: deduct from balance
// 3. If insufficient: charge via Stripe
// 4. Record transaction
// 5. Use idempotency key to prevent double charges
```

#### Prize Distribution
```typescript
// Prize pool calculation
const totalPrizePool = participants.length * buyInAmount;
const platformFee = totalPrizePool * 0.10; // 10% platform fee
const distributablePool = totalPrizePool - platformFee;

// Distribution rules
const distribution = {
  2: { 1: 1.0 },           // Winner takes all
  3: { 1: 0.70, 2: 0.30 }, // 70/30 split
  4: { 1: 0.60, 2: 0.25, 3: 0.15 } // 60/25/15 split
};
```

#### Payouts
```typescript
// process-payout edge function
// 1. Verify user balance
// 2. Create Stripe transfer
// 3. Deduct from player_accounts
// 4. Record transaction
// 5. Update balance
```

### Double Down Feature

Mid-match wager increase option:

```typescript
// Flow:
// 1. Any participant initiates double down vote
// 2. All participants must opt-in
// 3. If unanimous: additional buy-in charged
// 4. Prize pool increased
// 5. If not unanimous: no change

// double_down_participants table tracks:
// - opted_in: boolean
// - responded: boolean
// - payment_processed: boolean
```

### Incomplete Match Handling

Matches not completed within 24 hours are flagged:

```sql
-- pg_cron job runs hourly
SELECT flag_incomplete_matches();

-- Creates review records in incomplete_match_reviews
-- Admins can:
--   1. Forfeit incomplete players (complete match, winners get prizes)
--   2. Cancel match (refund all participants)
```

**User Visibility:**
- Incomplete matches highlighted in MatchFinder
- Warning banners on MatchScorecard
- Color-coded urgency (yellow → orange → red)

### Admin Features

#### User Management
- List all users with search/filter
- View user profiles and financial data
- Disable accounts (set membership_tier = 'disabled')
- Send magic link for passwordless login
- Force password reset

#### Match Management
- View all matches (incomplete, unstarted, active)
- Delete/cancel matches with refund processing
- Bulk match deletion
- Review flagged matches

#### Financial Operations
- View transaction history
- Create promotional coupons
- Process manual adjustments

#### Golf Course Management
- Import/export course database
- AI enrichment for course data
- Bulk data cleanup operations

### PWA Features

**Offline Support:**
- Service worker caches app shell
- IndexedDB stores pending scores
- Sync when connection restored

**Install Prompt:**
- Custom install UI for supported browsers
- iOS Safari instructions

**Update Notification:**
- Toast prompts when new version available
- One-click update and refresh

### AI-Powered Features

**Smart Course Search:**
```typescript
// Natural language queries
// "links courses near Chicago under $100"
// Uses AI to parse intent and search parameters
```

**Course Recommendations:**
```typescript
// Based on:
// - User's play history
// - Handicap level
// - Location preferences
// - Favorite courses
```

**Course Data Enrichment:**
```typescript
// AI generates:
// - Description
// - Amenities list
// - Difficulty rating
// - Course style classification
// - Search keywords
```

### Social Media Integration

**Ayrshare Integration:**
- Admin can post to connected social platforms
- Temporary media upload for posts
- Profile management in admin panel

## Feature Flags

Some features are gated by membership tier:

| Feature | Free | Pro |
|---------|------|-----|
| Create matches | ✓ | ✓ |
| Join matches | ✓ | ✓ |
| Smart course search | ✗ | ✓ |
| Course recommendations | Limited | Full |
| Double down | ✓ | ✓ |
