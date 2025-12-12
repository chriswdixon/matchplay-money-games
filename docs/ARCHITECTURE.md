# Architecture

## System Overview

MatchPlay is a React single-page application with a Supabase backend, designed for competitive golf match management with real-time features and payment processing.

```
┌─────────────────────────────────────────────────────────────────┐
│                        Client (Browser)                          │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                    React Application                     │    │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐  │    │
│  │  │    Pages    │  │    Hooks    │  │   Components    │  │    │
│  │  └─────────────┘  └─────────────┘  └─────────────────┘  │    │
│  │                          │                               │    │
│  │  ┌─────────────────────────────────────────────────┐    │    │
│  │  │              Supabase Client                     │    │    │
│  │  │  - Real-time subscriptions                       │    │    │
│  │  │  - Row Level Security enforcement                │    │    │
│  │  └─────────────────────────────────────────────────┘    │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Supabase Platform                           │
│  ┌─────────────────┐  ┌─────────────────┐  ┌────────────────┐   │
│  │   PostgreSQL    │  │  Edge Functions │  │  Supabase Auth │   │
│  │   - 23 tables   │  │  - Deno runtime │  │  - Email/Pass  │   │
│  │   - 75 RLS      │  │  - 20+ functions│  │  - MFA/TOTP    │   │
│  │   - Triggers    │  │  - Stripe SDK   │  │  - JWT tokens  │   │
│  └─────────────────┘  └─────────────────┘  └────────────────┘   │
│                              │                                    │
│  ┌─────────────────┐  ┌─────────────────┐  ┌────────────────┐   │
│  │    Storage      │  │    Realtime     │  │   pg_cron      │   │
│  │  - Avatars      │  │  - Score sync   │  │  - Scheduled   │   │
│  │  - Temp media   │  │  - Transactions │  │    jobs        │   │
│  └─────────────────┘  └─────────────────┘  └────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      External Services                           │
│  ┌─────────────────┐  ┌─────────────────┐  ┌────────────────┐   │
│  │     Stripe      │  │  Golf Course    │  │   Ayrshare     │   │
│  │  - Payments     │  │     API         │  │  - Social      │   │
│  │  - Payouts      │  │  - Course data  │  │    posting     │   │
│  └─────────────────┘  └─────────────────┘  └────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

## Frontend Architecture

### Component Hierarchy

```
App.tsx
├── ThemeProvider (dark/light mode)
├── QueryClientProvider (TanStack Query)
├── BrowserRouter
│   ├── EmailConfirmationBanner
│   ├── OfflineIndicator
│   ├── PWAUpdatePrompt
│   ├── CookieConsent
│   └── Routes
│       ├── Index (Landing/Dashboard)
│       ├── Auth (Login/Register)
│       ├── Profile (User settings)
│       ├── CreateMatch
│       ├── AdminConsole
│       └── [Other pages]
└── Toaster (Notifications)
```

### State Management

| Type | Technology | Use Case |
|------|------------|----------|
| Server State | TanStack Query | Database data, caching, refetching |
| Local State | React useState | Component-specific UI state |
| Global State | React Context | Auth, theme, offline status |
| Persistent State | localStorage | Form drafts, preferences, cookie consent |

### Custom Hooks Pattern

```typescript
// Data fetching hook pattern
export function useMatches() {
  const { user } = useAuth();
  
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['matches', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('matches')
        .select('*')
        .order('scheduled_time', { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  return { matches: data, loading: isLoading, refetch };
}
```

### Key Hooks

| Hook | Purpose |
|------|---------|
| `useAuth` | Authentication state and methods |
| `useMatches` | Match CRUD operations |
| `useMatchScoring` | Real-time score management |
| `useProfile` | User profile management |
| `useSubscription` | Membership tier and billing |
| `usePlayerAccount` | Balance and transactions |
| `useAdminRole` | Admin authorization check |

## Backend Architecture

### Database Design Principles

1. **Normalized Schema**: Core entities separated (profiles, matches, scores)
2. **JSONB for Flexibility**: `hole_pars`, `final_scores`, `metadata` fields
3. **Audit Trail**: Timestamp columns, audit log tables
4. **Soft Deletes**: Status fields instead of hard deletes

### Row Level Security (RLS)

Every table has RLS enabled with policies based on:
- Ownership (`user_id = auth.uid()`)
- Match participation
- Admin role checks via `has_role()` function

### Edge Functions Architecture

```
supabase/functions/
├── [function-name]/
│   └── index.ts          # Deno handler
└── _shared/              # Shared utilities (optional)
```

Standard edge function pattern:
```typescript
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // 1. Initialize clients
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 2. Authenticate user
    const authHeader = req.headers.get("Authorization");
    const { data: { user }, error } = await supabase.auth.getUser(
      authHeader?.replace("Bearer ", "")
    );
    if (error || !user) throw new Error("Unauthorized");

    // 3. Business logic
    const body = await req.json();
    // ... process request

    // 4. Return response
    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
```

## Data Flow Examples

### Match Creation
```
1. User fills CreateMatch form
2. Form validation (client-side)
3. supabase.from('matches').insert()
4. RLS policy checks user is authenticated
5. Database trigger validates data
6. Match created, user auto-joined as participant
7. Real-time subscription notifies other users
```

### Score Entry
```
1. Player enters score on MatchScorecard
2. Optimistic update in UI
3. supabase.from('match_scores').upsert()
4. Real-time broadcast to other participants
5. IndexedDB backup for offline support
6. Sync when back online
```

### Payment Processing
```
1. Match finalized → Edge Function triggered
2. calculate prize distribution
3. credit_match_winnings → Update player_accounts
4. Record transactions in account_transactions
5. User requests payout
6. process-payout → Stripe transfer
7. Record payout transaction
```

## Performance Considerations

### Caching Strategy
- TanStack Query with `staleTime: 5 * 60 * 1000` (5 minutes)
- Optimistic updates for immediate UI feedback
- Background refetching on window focus

### Lazy Loading
- Route-based code splitting via React Router
- Images lazy loaded with Intersection Observer

### Real-time Efficiency
- Subscribe only to needed channels
- Unsubscribe on component unmount
- Debounce score updates (500ms)

## Offline Support

### PWA Configuration
```typescript
// vite.config.ts
VitePWA({
  registerType: 'prompt',
  workbox: {
    globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
    runtimeCaching: [
      {
        urlPattern: /^https:\/\/.*supabase.*$/,
        handler: 'NetworkFirst',
        options: { cacheName: 'supabase-cache' }
      }
    ]
  }
})
```

### IndexedDB for Scores
```typescript
// src/lib/offlineDb.ts
const db = await openDB('matchplay-offline', 1, {
  upgrade(db) {
    db.createObjectStore('pending-scores', { keyPath: 'id' });
  }
});
```

## Error Handling

### Client-Side
```typescript
// src/lib/errorHandling.ts
export function handleError(error: unknown, context: string) {
  console.error(`[${context}]`, error);
  
  if (error instanceof AuthError) {
    toast.error("Session expired. Please log in again.");
    // Redirect to auth
  } else if (error instanceof PostgrestError) {
    toast.error("Database error. Please try again.");
  } else {
    toast.error("An unexpected error occurred.");
  }
}
```

### Edge Functions
- Return sanitized error messages (no internal details)
- Log full errors server-side
- Use appropriate HTTP status codes
