# Edge Functions

## Overview

MatchPlay uses Supabase Edge Functions (Deno runtime) for server-side operations that require:
- Secret API keys (Stripe, external APIs)
- Complex business logic
- Admin-only operations
- Scheduled tasks

## Function Catalog

### Payment Functions

| Function | Purpose | Auth Required |
|----------|---------|---------------|
| `charge-match-buyin` | Charge entry fee from balance or Stripe | User |
| `credit-match-winnings` | Distribute prizes to winners | Service role |
| `process-payout` | Withdraw balance to bank account | User |
| `create-checkout` | Create Stripe checkout session | User |
| `create-setup-intent` | Setup payment method | User |
| `customer-portal` | Stripe customer portal link | User |

### Admin Functions

| Function | Purpose | Auth Required |
|----------|---------|---------------|
| `admin-list-users` | Paginated user list | Admin |
| `admin-disable-user` | Disable user account | Admin |
| `admin-magic-link` | Generate login link for user | Admin |
| `admin-password-reset` | Send password reset email | Admin |
| `admin-create-coupon` | Create Stripe coupon | Admin |
| `admin-list-coupons` | List active coupons | Admin |

### Golf Course Functions

| Function | Purpose | Auth Required |
|----------|---------|---------------|
| `search-golf-courses` | Search external golf API | User |
| `create-golf-course` | Add course to database | Admin |
| `import-golf-courses` | Bulk import courses | Admin |
| `export-all-courses` | Export course database | Admin |
| `enrich-golf-course` | AI-enhance course data | Admin |
| `smart-course-search` | Natural language course search | Paid user |
| `recommend-courses` | Personalized recommendations | User |
| `cleanup-course-data` | Standardize course data | Admin |

### Other Functions

| Function | Purpose | Auth Required |
|----------|---------|---------------|
| `check-subscription` | Verify membership status | User |
| `request-invite` | Request platform invite | Public |
| `ayrshare-post` | Post to social media | Admin |
| `flag-incomplete-matches` | Scheduled cleanup | Service role |
| `record-double-down-vote` | Record double down decision | User |
| `process-double-down-payments` | Process double down fees | Service role |
| `setup-payment-method` | Attach payment method | User |

## Standard Function Pattern

```typescript
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { z } from "https://esm.sh/zod@3.22.4";

// CORS headers for browser requests
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Structured logging
const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[FUNCTION_NAME] ${step}${detailsStr}`);
};

// Input validation schema
const RequestSchema = z.object({
  matchId: z.string().uuid(),
  amount: z.number().positive().optional(),
});

serve(async (req) => {
  // 1. Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    // 2. Initialize Supabase client with service role
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // 3. Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }
    
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = 
      await supabaseClient.auth.getUser(token);
    
    if (userError || !user) {
      throw new Error("Unauthorized");
    }
    
    logStep("User authenticated", { userId: user.id });

    // 4. Validate input
    const body = await req.json();
    const validatedInput = RequestSchema.parse(body);
    logStep("Input validated", validatedInput);

    // 5. Business logic
    // ... your code here

    // 6. Return success response
    return new Response(
      JSON.stringify({ success: true, data: result }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );

  } catch (error) {
    // 7. Error handling - sanitize error message
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    
    // Determine status code
    let status = 500;
    if (errorMessage.includes("Unauthorized")) status = 401;
    if (errorMessage.includes("Forbidden")) status = 403;
    if (errorMessage.includes("not found")) status = 404;
    if (error instanceof z.ZodError) status = 400;
    
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status,
      }
    );
  }
});
```

## Admin Function Pattern

```typescript
// Additional admin role verification
serve(async (req) => {
  // ... CORS and auth as above ...

  // Check admin role
  const { data: roleData, error: roleError } = await supabaseClient
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .eq('role', 'admin')
    .maybeSingle();

  if (roleError || !roleData) {
    logStep("Admin check failed", { userId: user.id });
    return new Response(
      JSON.stringify({ error: "Admin access required" }),
      { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  logStep("Admin verified", { userId: user.id });
  
  // ... admin operation ...
  
  // Log admin action
  await supabaseClient.from('admin_access_log').insert({
    admin_user_id: user.id,
    action: 'operation_name',
    accessed_table: 'table_name',
    accessed_user_id: targetUserId,
    metadata: { /* operation details */ }
  });
});
```

## Stripe Integration Pattern

```typescript
// Initialize Stripe
const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
  apiVersion: "2025-08-27.basil",
});

// Find or create customer
let customerId: string;
const customers = await stripe.customers.list({ 
  email: user.email!, 
  limit: 1 
});

if (customers.data.length > 0) {
  customerId = customers.data[0].id;
} else {
  const customer = await stripe.customers.create({
    email: user.email!,
    metadata: { user_id: user.id }
  });
  customerId = customer.id;
}

// Create payment intent with idempotency
const paymentIntent = await stripe.paymentIntents.create({
  amount: amountInCents,
  currency: 'usd',
  customer: customerId,
  metadata: {
    user_id: user.id,
    match_id: matchId,
  },
}, {
  idempotencyKey: `match-${matchId}-user-${user.id}-buyin`,
});
```

## Rate Limiting Pattern

```typescript
// Check rate limit for sensitive operations
const { data: recentAttempts } = await supabaseClient
  .from('pin_attempts')
  .select('id')
  .eq('user_id', user.id)
  .eq('match_id', matchId)
  .gte('attempted_at', new Date(Date.now() - 15 * 60 * 1000).toISOString());

if (recentAttempts && recentAttempts.length >= 5) {
  throw new Error("Too many attempts. Please wait 15 minutes.");
}
```

## Error Handling Best Practices

1. **Sanitize Errors**: Never expose internal errors to clients
2. **Log Details**: Log full error for debugging
3. **Appropriate Status Codes**: Use correct HTTP status codes
4. **Zod Validation**: Use Zod for input validation with clear error messages

```typescript
try {
  // ... operation
} catch (error) {
  // Log full error internally
  console.error("Full error:", error);
  
  // Return sanitized message
  const publicMessage = error instanceof z.ZodError
    ? "Invalid input: " + error.errors.map(e => e.message).join(", ")
    : "An error occurred processing your request";
  
  return new Response(JSON.stringify({ error: publicMessage }), {
    status: error instanceof z.ZodError ? 400 : 500,
    headers: corsHeaders
  });
}
```

## Deployment

### Via Lovable
Edge functions are automatically deployed when changes are saved in Lovable.

### Via CLI (local development)
```bash
# Deploy single function
supabase functions deploy function-name

# Deploy all functions
supabase functions deploy
```

### Environment Variables

Secrets are configured in Supabase Dashboard → Edge Functions → Secrets:

| Secret | Description |
|--------|-------------|
| `STRIPE_SECRET_KEY` | Stripe API secret key |
| `GOLFCOURSEAPI_KEY` | Golf Course API key |
| `AYRSHARE_API_KEY` | Social media API key |

Access in code:
```typescript
const apiKey = Deno.env.get("STRIPE_SECRET_KEY");
```

## Testing Edge Functions

### Via Lovable
Use the edge function testing tools in the admin panel.

### Via cURL
```bash
curl -X POST 'https://your-project.supabase.co/functions/v1/function-name' \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"key": "value"}'
```

### Via Supabase Client
```typescript
const { data, error } = await supabase.functions.invoke('function-name', {
  body: { key: 'value' }
});
```

## Logging & Debugging

View logs in Supabase Dashboard → Edge Functions → Logs

```typescript
// Structured logging for easy filtering
console.log(`[FUNCTION_NAME] Step description - ${JSON.stringify(data)}`);
console.error(`[FUNCTION_NAME] ERROR - ${errorMessage}`);
```

## Common Patterns

### Transaction with Rollback
```typescript
// For multi-step operations that need atomicity
const processedPayments: string[] = [];

try {
  for (const participant of participants) {
    await processPayment(participant);
    processedPayments.push(participant.id);
  }
} catch (error) {
  // Rollback on failure
  for (const paymentId of processedPayments) {
    await refundPayment(paymentId);
  }
  throw error;
}
```

### Database Transaction
```typescript
// Use Supabase RPC for atomic operations
const { data, error } = await supabaseClient.rpc('finalize_match_results', {
  p_match_id: matchId
});
```
