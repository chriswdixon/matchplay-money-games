# Authentication & Authorization

## Overview

MatchPlay uses Supabase Auth for authentication with support for email/password login and TOTP-based MFA. Authorization is handled through role-based access control (RBAC) with Row Level Security (RLS) at the database level.

## Authentication Flow

### Registration

```
┌─────────────────┐      ┌─────────────────┐      ┌──────────────────┐
│   Auth Form     │──────│  Supabase Auth  │──────│   auth.users     │
│  (email/pass)   │      │   signUp()      │      │   (created)      │
└─────────────────┘      └─────────────────┘      └────────┬─────────┘
                                                           │
                                                           ▼
                                               ┌───────────────────────┐
                                               │  Database Trigger     │
                                               │  handle_new_user()    │
                                               └───────────┬───────────┘
                                                           │
                    ┌──────────────────────────────────────┼──────────────────────────────────────┐
                    ▼                                      ▼                                      ▼
          ┌─────────────────┐                    ┌─────────────────────┐                ┌─────────────────────┐
          │    profiles     │                    │ private_profile_data│                │  player_accounts    │
          │   (created)     │                    │     (created)       │                │     (created)       │
          └─────────────────┘                    └─────────────────────┘                └─────────────────────┘
```

### Login

```typescript
// src/hooks/useAuth.tsx
const signIn = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  
  if (error) throw error;
  
  // Check if MFA is required
  if (data.session?.user?.factors?.length > 0) {
    // Redirect to MFA verification
    return { requiresMFA: true };
  }
  
  return { user: data.user };
};
```

### Session Management

```typescript
// Session is stored in localStorage by Supabase
// Auto-refresh handled by Supabase client

// Subscribe to auth state changes
useEffect(() => {
  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    (event, session) => {
      if (event === 'SIGNED_IN') {
        setUser(session?.user ?? null);
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
      } else if (event === 'TOKEN_REFRESHED') {
        setUser(session?.user ?? null);
      }
    }
  );
  
  return () => subscription.unsubscribe();
}, []);
```

## Multi-Factor Authentication (MFA)

### Enrollment

```typescript
// src/components/auth/MFAEnrollment.tsx
const enrollMFA = async () => {
  // 1. Generate TOTP secret
  const { data: factorData, error: factorError } = 
    await supabase.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: 'Authenticator App'
    });
  
  if (factorError) throw factorError;
  
  // 2. Display QR code for user to scan
  setQrCode(factorData.totp.qr_code);
  setSecret(factorData.totp.secret);
  
  // 3. User enters code from authenticator app
  // 4. Verify and activate
  const { error: verifyError } = await supabase.auth.mfa.verify({
    factorId: factorData.id,
    code: userEnteredCode,
    challengeId: challenge.id,
  });
};
```

### Verification on Login

```typescript
// src/components/auth/MFAVerification.tsx
const verifyMFA = async (code: string) => {
  const { data: factors } = await supabase.auth.mfa.listFactors();
  const totpFactor = factors.totp[0];
  
  const { data: challenge } = await supabase.auth.mfa.challenge({
    factorId: totpFactor.id,
  });
  
  const { error } = await supabase.auth.mfa.verify({
    factorId: totpFactor.id,
    challengeId: challenge.id,
    code,
  });
  
  if (error) throw error;
  // User is now fully authenticated
};
```

## Role-Based Access Control

### Roles

| Role | Description | Capabilities |
|------|-------------|--------------|
| `user` | Default role | Create/join matches, manage profile |
| `moderator` | Content moderation | Review flagged content |
| `admin` | Full access | User management, financial ops, system config |

### Database Implementation

```sql
-- Role enum
CREATE TYPE app_role AS ENUM ('admin', 'moderator', 'user');

-- Role assignments
CREATE TABLE user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, role)
);

-- Helper function
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

### Client-Side Role Check

```typescript
// src/hooks/useAdminRole.tsx
export function useAdminRole() {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAdminRole = async () => {
      if (!user) {
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .maybeSingle();

      setIsAdmin(!!data && !error);
      setLoading(false);
    };

    checkAdminRole();
  }, [user]);

  return { isAdmin, loading };
}
```

**Important**: Client-side checks are for UX only. All admin operations are protected by server-side authorization in edge functions and RLS policies.

### Server-Side Authorization (Edge Functions)

```typescript
// Standard pattern for admin-only edge functions
serve(async (req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // 1. Get user from token
  const authHeader = req.headers.get("Authorization");
  const token = authHeader?.replace("Bearer ", "");
  const { data: { user }, error } = await supabase.auth.getUser(token);
  
  if (error || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401
    });
  }

  // 2. Check admin role
  const { data: roleData } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .eq('role', 'admin')
    .maybeSingle();

  if (!roleData) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403
    });
  }

  // 3. Proceed with admin operation...
});
```

## Row Level Security Patterns

### User Ownership

```sql
-- Only owner can read/write their private data
CREATE POLICY "Users can view own private data"
ON private_profile_data FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Users can update own private data"
ON private_profile_data FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());
```

### Match Participation

```sql
-- Participants can view match scores
CREATE POLICY "Participants can view scores"
ON match_scores FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM match_participants
    WHERE match_participants.match_id = match_scores.match_id
    AND match_participants.user_id = auth.uid()
  )
);
```

### Admin Override

```sql
-- Admins can access all user data
CREATE POLICY "Admins can view all profiles"
ON private_profile_data FOR SELECT
USING (
  user_id = auth.uid() OR 
  has_role(auth.uid(), 'admin')
);
```

### Service Role Bypass

```sql
-- Some operations require service role (used by edge functions)
CREATE POLICY "Service role can insert transactions"
ON account_transactions FOR INSERT
WITH CHECK (true);  -- Edge functions use service role key
```

## Password Requirements

```typescript
// src/lib/validation.ts
export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .regex(/[A-Z]/, "Password must contain an uppercase letter")
  .regex(/[a-z]/, "Password must contain a lowercase letter")
  .regex(/[0-9]/, "Password must contain a number")
  .regex(/[^A-Za-z0-9]/, "Password must contain a special character");
```

## Email Verification

```typescript
// Email verification is required before full access
// Unverified users see EmailConfirmationBanner

const { data: { user } } = await supabase.auth.getUser();
const isEmailVerified = user?.email_confirmed_at !== null;
```

## Session Security

- JWT tokens with 1-hour expiry
- Automatic refresh via Supabase client
- Tokens stored in localStorage (configurable)
- HTTPS required for all auth endpoints

## Audit Logging

Admin access is logged for compliance:

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
```

```typescript
// Logged in edge functions after admin operations
await supabase.from('admin_access_log').insert({
  admin_user_id: user.id,
  action: 'disable_user',
  accessed_table: 'private_profile_data',
  accessed_user_id: targetUserId,
  metadata: { reason: 'TOS violation' }
});
```
