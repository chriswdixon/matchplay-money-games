# Testing & Debugging Guide

## Debugging Strategies

### Console Logs

Access browser console to view:
- React component errors
- Network request failures
- Supabase real-time events

```typescript
// Structured logging in components
console.log('[ComponentName] Action:', { data });
console.error('[ComponentName] Error:', error);
```

### Network Requests

Monitor network tab for:
- Supabase REST API calls
- Edge function invocations
- Stripe webhook responses

### Supabase Logs

Access via Supabase Dashboard:
- **Database Logs**: SQL errors, slow queries
- **Auth Logs**: Login attempts, token issues
- **Edge Function Logs**: Function execution, errors

```sql
-- Query recent database logs
SELECT identifier, timestamp, event_message, parsed.error_severity 
FROM postgres_logs
CROSS JOIN unnest(metadata) as m
CROSS JOIN unnest(m.parsed) as parsed
ORDER BY timestamp DESC
LIMIT 100;

-- Query auth logs
SELECT id, timestamp, event_message, metadata.level, metadata.status 
FROM auth_logs
CROSS JOIN unnest(metadata) as metadata
ORDER BY timestamp DESC
LIMIT 100;
```

### Edge Function Debugging

```typescript
// Add structured logging
const logStep = (step: string, details?: unknown) => {
  console.log(`[FUNCTION_NAME] ${step}`, details ? JSON.stringify(details) : '');
};

logStep("Starting", { userId: user.id });
logStep("Query result", { count: data.length });
logStep("ERROR", { message: error.message });
```

View logs: Supabase Dashboard → Edge Functions → Select function → Logs

## Common Issues

### Authentication Issues

**Symptom**: User gets logged out unexpectedly

**Debug Steps**:
1. Check auth logs for token refresh failures
2. Verify session in localStorage
3. Check for CORS issues on edge functions

```typescript
// Debug auth state
const { data: { session } } = await supabase.auth.getSession();
console.log('Session:', session);
console.log('Expires at:', new Date(session?.expires_at * 1000));
```

### RLS Policy Issues

**Symptom**: Data not returned or "permission denied"

**Debug Steps**:
1. Check which policies apply to the table
2. Verify user ID matches expected value
3. Test policy with SQL directly

```sql
-- Check current user context
SELECT auth.uid();

-- Test policy logic directly
SELECT * FROM matches
WHERE status = 'open' OR created_by = '<user-uuid>';
```

### Real-Time Subscription Issues

**Symptom**: Changes not appearing in real-time

**Debug Steps**:
```typescript
// Verify subscription is active
const channel = supabase
  .channel('match_scores')
  .on('postgres_changes', 
    { event: '*', schema: 'public', table: 'match_scores' },
    (payload) => {
      console.log('Real-time event:', payload);
    }
  )
  .subscribe((status) => {
    console.log('Subscription status:', status);
  });
```

### Edge Function Failures

**Symptom**: Function returns 500 error

**Debug Steps**:
1. Check edge function logs
2. Verify environment variables are set
3. Test with curl to isolate client vs server issues

```bash
# Test edge function directly
curl -X POST 'https://your-project.supabase.co/functions/v1/function-name' \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"key": "value"}'
```

### Payment Issues

**Symptom**: Charge fails or is duplicated

**Debug Steps**:
1. Check Stripe Dashboard for payment events
2. Verify idempotency key usage
3. Check transaction table for duplicates

```typescript
// Log payment flow
logStep("Creating payment intent", { 
  amount, 
  customerId, 
  idempotencyKey: `match-${matchId}-user-${userId}` 
});
```

## Database Queries for Debugging

### Check User State

```sql
-- Get complete user state
SELECT 
  p.display_name,
  p.handicap,
  ppd.membership_tier,
  pa.balance,
  ur.role
FROM profiles p
JOIN private_profile_data ppd ON p.user_id = ppd.user_id
JOIN player_accounts pa ON p.user_id = pa.user_id
LEFT JOIN user_roles ur ON p.user_id = ur.user_id
WHERE p.user_id = '<user-uuid>';
```

### Check Match State

```sql
-- Get match with all participants and scores
SELECT 
  m.*,
  mp.user_id as participant_id,
  mp.status as participant_status,
  mp.team_number,
  (SELECT COUNT(*) FROM match_scores ms WHERE ms.match_id = m.id AND ms.player_id = mp.user_id) as scores_entered
FROM matches m
JOIN match_participants mp ON m.id = mp.match_id
WHERE m.id = '<match-uuid>';
```

### Check Transaction History

```sql
-- Get user transactions
SELECT 
  at.created_at,
  at.transaction_type,
  at.amount / 100.0 as amount_dollars,
  at.description,
  m.course_name as match_name
FROM account_transactions at
LEFT JOIN matches m ON at.match_id = m.id
WHERE at.user_id = '<user-uuid>'
ORDER BY at.created_at DESC
LIMIT 20;
```

### Find Incomplete Matches

```sql
-- Matches started but not completed
SELECT 
  m.id,
  m.course_name,
  m.scheduled_time,
  m.status,
  NOW() - m.scheduled_time as time_elapsed
FROM matches m
LEFT JOIN match_results mr ON m.id = mr.match_id
WHERE m.status = 'started'
AND mr.finalized_at IS NULL
ORDER BY m.scheduled_time ASC;
```

## Testing Edge Functions Locally

### Setup

```bash
# Install Supabase CLI
npm install -g supabase

# Start local Supabase
supabase start

# Serve functions locally
supabase functions serve
```

### Environment Variables

```bash
# Create .env.local for edge functions
STRIPE_SECRET_KEY=sk_test_...
GOLFCOURSEAPI_KEY=...
```

### Test with curl

```bash
# Get a test JWT
supabase auth sign-in-with-password \
  --email test@example.com \
  --password testpassword

# Call function
curl -X POST 'http://localhost:54321/functions/v1/function-name' \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"key": "value"}'
```

## React Component Debugging

### React DevTools

1. Install React DevTools browser extension
2. Inspect component tree
3. View props and state
4. Profile re-renders

### TanStack Query DevTools

```typescript
// Already included in App.tsx
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

// View cache state, active queries, mutations
<ReactQueryDevtools initialIsOpen={false} />
```

### Debug Hooks

```typescript
// Log hook state changes
useEffect(() => {
  console.log('[useMatches] State changed:', { matches, loading, error });
}, [matches, loading, error]);
```

## Performance Debugging

### Slow Queries

Check Supabase Dashboard → Database → Performance for:
- Slow query log
- Index usage
- Table sizes

### React Profiler

```typescript
import { Profiler } from 'react';

<Profiler id="MatchList" onRender={(id, phase, actualDuration) => {
  console.log(`${id} ${phase}: ${actualDuration}ms`);
}}>
  <MatchList />
</Profiler>
```

### Network Waterfall

Use browser DevTools Network tab to identify:
- Sequential requests that could be parallelized
- Unnecessary re-fetches
- Large payload sizes

## Error Reporting

### Client-Side Errors

```typescript
// src/lib/errorHandling.ts
export function handleError(error: unknown, context: string) {
  console.error(`[${context}]`, error);
  
  // Determine error type and show appropriate toast
  if (error instanceof AuthError) {
    toast.error("Please log in again");
  } else if (error instanceof PostgrestError) {
    toast.error("Database error. Please try again.");
  } else {
    toast.error("Something went wrong");
  }
  
  // Could also send to error tracking service here
}
```

### Edge Function Errors

```typescript
catch (error) {
  // Log full error for debugging
  console.error('[FUNCTION_NAME] Full error:', error);
  
  // Return sanitized message
  return new Response(
    JSON.stringify({ 
      error: 'An error occurred', 
      requestId: crypto.randomUUID() // For support reference
    }),
    { status: 500 }
  );
}
```

## Checklist for Bug Investigation

1. **Reproduce the issue**
   - [ ] Get exact steps from user
   - [ ] Check browser console
   - [ ] Check network requests

2. **Identify the layer**
   - [ ] Client-side (React component)?
   - [ ] Edge function?
   - [ ] Database/RLS?
   - [ ] External service (Stripe)?

3. **Gather evidence**
   - [ ] Console errors
   - [ ] Network request/response
   - [ ] Edge function logs
   - [ ] Database query results

4. **Fix and verify**
   - [ ] Implement fix
   - [ ] Test same scenario
   - [ ] Check for regressions
