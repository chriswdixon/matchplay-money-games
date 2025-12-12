# Security Documentation

## Security Architecture

MatchPlay implements defense-in-depth with multiple security layers:

```
┌─────────────────────────────────────────────────────────────┐
│                      Client Layer                           │
│  - Input validation (Zod schemas)                          │
│  - XSS prevention (React escaping)                         │
│  - CSRF protection (Supabase tokens)                       │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   Edge Function Layer                        │
│  - Authentication verification                              │
│  - Authorization checks (admin role)                        │
│  - Input validation (Zod)                                   │
│  - Rate limiting                                            │
│  - Error sanitization                                       │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Database Layer                            │
│  - Row Level Security (RLS)                                 │
│  - Trigger-based validation                                 │
│  - SECURITY DEFINER functions                               │
│  - Audit logging                                            │
└─────────────────────────────────────────────────────────────┘
```

## Row Level Security (RLS)

### Policy Patterns

All 23 tables have RLS enabled with 75+ policies following these patterns:

#### 1. Owner-Only Access
```sql
CREATE POLICY "Users can view own data"
ON private_profile_data FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Users can update own data"
ON private_profile_data FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());
```

#### 2. Participant Access
```sql
CREATE POLICY "Participants can view match scores"
ON match_scores FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM match_participants mp
    WHERE mp.match_id = match_scores.match_id
    AND mp.user_id = auth.uid()
  )
);
```

#### 3. Admin Override
```sql
CREATE POLICY "Admins can view all data"
ON private_profile_data FOR SELECT
USING (
  user_id = auth.uid() OR
  has_role(auth.uid(), 'admin')
);
```

#### 4. Conditional Public Access
```sql
CREATE POLICY "Anyone can view open matches"
ON matches FOR SELECT
USING (
  status = 'open' OR
  created_by = auth.uid() OR
  is_user_match_participant(id, auth.uid()) OR
  has_role(auth.uid(), 'admin')
);
```

#### 5. Service Role Only (Edge Functions)
```sql
CREATE POLICY "Service role can insert transactions"
ON account_transactions FOR INSERT
WITH CHECK (true);  -- Only service role bypasses RLS
```

## Input Validation

### Client-Side (React)

```typescript
// src/lib/validation.ts
import { z } from 'zod';

// Password requirements
export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .regex(/[A-Z]/, "Must contain uppercase letter")
  .regex(/[a-z]/, "Must contain lowercase letter")
  .regex(/[0-9]/, "Must contain number")
  .regex(/[^A-Za-z0-9]/, "Must contain special character");

// Match creation
export const matchSchema = z.object({
  course_name: z.string().min(1).max(200),
  buy_in_amount: z.number().min(0).max(50000), // cents
  handicap_min: z.number().min(-10).max(54).optional(),
  handicap_max: z.number().min(-10).max(54).optional(),
  scheduled_time: z.date().min(new Date()),
});

// Score validation
export const scoreSchema = z.object({
  strokes: z.number().int().min(1).max(20),
  hole_number: z.number().int().min(1).max(18),
});
```

### Server-Side (Edge Functions)

```typescript
import { z } from "https://esm.sh/zod@3.22.4";

const RequestSchema = z.object({
  matchId: z.string().uuid(),
  amount: z.number().positive().int(),
});

// In handler
const body = await req.json();
const { matchId, amount } = RequestSchema.parse(body);
```

### Database-Level (Triggers)

```sql
-- Validate handicap range
CREATE FUNCTION validate_handicap()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.handicap IS NOT NULL AND 
     (NEW.handicap < -10 OR NEW.handicap > 54) THEN
    RAISE EXCEPTION 'Handicap must be between -10 and 54';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Validate score range
CREATE FUNCTION validate_score()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.strokes IS NOT NULL AND 
     (NEW.strokes < 1 OR NEW.strokes > 20) THEN
    RAISE EXCEPTION 'Score must be between 1 and 20';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

## Authentication Security

### Password Hashing
Handled by Supabase Auth (bcrypt with salt)

### Session Management
- JWT tokens with 1-hour expiry
- Automatic refresh via Supabase client
- Secure storage in localStorage

### MFA Support
- TOTP-based (authenticator apps)
- AAL2 (Authenticator Assurance Level 2) for sensitive operations

### Rate Limiting

**PIN Attempts:**
```sql
-- Track attempts
INSERT INTO pin_attempts (user_id, match_id, success)
VALUES (auth.uid(), p_match_id, false);

-- Check recent attempts
SELECT COUNT(*) FROM pin_attempts
WHERE user_id = auth.uid()
AND match_id = p_match_id
AND attempted_at > NOW() - INTERVAL '15 minutes';

-- Block after 5 failed attempts
```

**API Rate Limiting:**
- Edge function timeouts: 60 seconds
- Supabase connection pooling limits

## Authorization

### Role-Based Access Control

```sql
CREATE TYPE app_role AS ENUM ('admin', 'moderator', 'user');

CREATE TABLE user_roles (
  user_id UUID NOT NULL,
  role app_role NOT NULL,
  UNIQUE(user_id, role)
);

-- Secure role check function
CREATE FUNCTION has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;
```

### Server-Side Verification

```typescript
// All admin edge functions verify role
const { data: roleData } = await supabase
  .from('user_roles')
  .select('role')
  .eq('user_id', user.id)
  .eq('role', 'admin')
  .maybeSingle();

if (!roleData) {
  throw new Error("Admin access required");
}
```

### Client-Side (UX Only)

```typescript
// useAdminRole hook - for UI gating only
// NOT a security measure - all operations protected server-side
export function useAdminRole() {
  const { user } = useAuth();
  // ... check role for UI display
}
```

## Payment Security

### Stripe Integration

```typescript
// Idempotency keys prevent duplicate charges
const paymentIntent = await stripe.paymentIntents.create({
  amount: amountInCents,
  currency: 'usd',
  customer: customerId,
  metadata: { user_id: user.id, match_id: matchId },
}, {
  idempotencyKey: `match-${matchId}-user-${user.id}-buyin`,
});

// Unique constraints in database
CREATE UNIQUE INDEX unique_match_buyin_transaction
ON account_transactions (user_id, match_id, transaction_type)
WHERE transaction_type = 'match_buyin';
```

### Transaction Rollback

```typescript
// Multi-step payment operations track progress
const processedPayments: string[] = [];

try {
  for (const participant of participants) {
    await processPayment(participant);
    processedPayments.push(participant.id);
  }
} catch (error) {
  // Rollback all processed payments
  for (const paymentId of processedPayments) {
    await refundPayment(paymentId);
  }
  throw error;
}
```

## Audit Logging

### Admin Actions

```sql
CREATE TABLE admin_access_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID NOT NULL,
  action TEXT NOT NULL,
  accessed_table TEXT NOT NULL,
  accessed_user_id UUID,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Logged in edge functions
await supabase.from('admin_access_log').insert({
  admin_user_id: user.id,
  action: 'disable_user',
  accessed_table: 'private_profile_data',
  accessed_user_id: targetUserId,
  metadata: { reason: 'TOS violation' }
});
```

### Profile Changes

```sql
CREATE TABLE profile_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  profile_id UUID REFERENCES profiles(id),
  action TEXT NOT NULL,
  old_data JSONB,
  new_data JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Trigger logs all profile updates
CREATE TRIGGER log_profile_changes
AFTER UPDATE ON profiles
FOR EACH ROW
EXECUTE FUNCTION log_profile_update();
```

## Error Handling

### Edge Functions

```typescript
try {
  // Operation
} catch (error) {
  // Log full error server-side
  console.error("Full error:", error);
  
  // Return sanitized message to client
  const publicMessage = error instanceof z.ZodError
    ? "Invalid input"
    : "An error occurred";
  
  return new Response(
    JSON.stringify({ error: publicMessage }),
    { status: 500 }
  );
}
```

### Never Expose

- Stack traces
- Database connection strings
- API keys
- Internal table/column names
- SQL error details

## XSS Prevention

### React Escaping
React automatically escapes content in JSX:
```tsx
// Safe - React escapes this
<div>{userInput}</div>

// Dangerous - only used with sanitization
<div dangerouslySetInnerHTML={{ __html: sanitizedHtml }} />
```

### Content Security Policy
Recommended headers (configure in hosting):
```
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline';
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
```

## SQL Injection Prevention

### Parameterized Queries
Supabase client automatically parameterizes:
```typescript
// Safe - parameterized by Supabase
const { data } = await supabase
  .from('matches')
  .select()
  .eq('id', userInput);
```

### Sanitization Function

```sql
CREATE FUNCTION sanitize_text_input(input_text TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Remove potential SQL injection patterns
  RETURN regexp_replace(
    input_text,
    '[;\-\-''\"\\]',
    '',
    'g'
  );
END;
$$;
```

## Security Checklist

### Before Deployment
- [ ] All tables have RLS enabled
- [ ] All admin operations verify role server-side
- [ ] Input validation on client and server
- [ ] Error messages sanitized
- [ ] API keys in Supabase secrets (not code)
- [ ] Audit logging for sensitive operations

### Periodic Review
- [ ] Review RLS policies for new tables
- [ ] Check edge function authorization
- [ ] Audit admin access logs
- [ ] Review transaction logs for anomalies
- [ ] Update dependencies for security patches
