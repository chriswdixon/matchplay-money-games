# Contributing Guide

## Code Standards

### TypeScript

- Use strict TypeScript (`"strict": true`)
- Prefer explicit types over `any`
- Use interfaces for object shapes
- Use type aliases for unions/complex types

```typescript
// ✅ Good
interface Match {
  id: string;
  course_name: string;
  buy_in_amount: number;
}

type MatchStatus = 'open' | 'started' | 'completed' | 'cancelled';

// ❌ Bad
const match: any = { ... };
```

### React Components

**Functional Components Only**
```typescript
// ✅ Good
export const MatchCard = ({ match }: { match: Match }) => {
  return <div>...</div>;
};

// ❌ Bad - class components
class MatchCard extends React.Component { ... }
```

**Use Custom Hooks for Logic**
```typescript
// ✅ Good - logic in hook
const { matches, loading, createMatch } = useMatches();

// ❌ Bad - logic in component
const [matches, setMatches] = useState([]);
useEffect(() => { fetchMatches().then(setMatches); }, []);
```

**Component Size**
- Keep components under 200 lines
- Extract sub-components for complex UI
- One component per file

### File Organization

```
src/
├── components/
│   ├── ui/                    # shadcn/ui primitives
│   ├── auth/                  # Auth-related components
│   ├── admin/                 # Admin-only components
│   ├── profile/               # Profile management
│   └── [Feature]Component.tsx # Feature components
├── hooks/
│   └── use[Feature].tsx       # Custom hooks
├── pages/
│   └── [Page].tsx            # Route components
├── lib/
│   └── [utility].ts          # Utility functions
└── integrations/
    └── supabase/             # Supabase client & types
```

### Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Components | PascalCase | `MatchCard.tsx` |
| Hooks | camelCase with "use" | `useMatches.tsx` |
| Utilities | camelCase | `formatDate.ts` |
| Types/Interfaces | PascalCase | `interface Match` |
| Constants | SCREAMING_SNAKE | `const MAX_PLAYERS = 16` |

### Styling

**Use Design System Tokens**
```typescript
// ✅ Good - uses semantic tokens
className="bg-background text-foreground border-border"

// ❌ Bad - hard-coded colors
className="bg-white text-black border-gray-200"
```

**Responsive Design**
```typescript
// Mobile-first with Tailwind breakpoints
className="w-full md:w-1/2 lg:w-1/3"
```

**Component Variants**
```typescript
// Use CVA for component variants
const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-md",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground",
        outline: "border border-input bg-background",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 px-3",
        lg: "h-11 px-8",
      },
    },
  }
);
```

## Git Workflow

### Branch Naming

```
feature/add-double-down
fix/payment-duplicate-charge
refactor/match-scoring-hook
docs/update-readme
```

### Commit Messages

Follow conventional commits:

```
feat: add double down voting feature
fix: prevent duplicate payment charges
refactor: extract useMatchScoring hook
docs: update API documentation
chore: update dependencies
```

### Pull Request Process

1. Create feature branch from `main`
2. Make changes with clear commits
3. Test locally
4. Create PR with description:
   - What changes were made
   - Why they were needed
   - How to test
5. Request review
6. Address feedback
7. Merge when approved

## Adding New Features

### 1. Plan the Feature

- Define requirements
- Identify affected components
- Consider database changes
- Plan edge functions if needed

### 2. Database Changes

If schema changes needed:
1. Create migration via Supabase
2. Add RLS policies
3. Update types (auto-generated)

### 3. Implement Backend

If edge functions needed:
1. Create function in `supabase/functions/`
2. Follow standard patterns (auth, validation)
3. Add error handling
4. Test with curl

### 4. Implement Frontend

1. Create/update hooks for data fetching
2. Build components
3. Use design system tokens
4. Add loading/error states
5. Test user flows

### 5. Document

- Update relevant docs
- Add JSDoc comments for complex functions
- Update this guide if patterns change

## Edge Function Guidelines

### Standard Template

```typescript
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { z } from "https://esm.sh/zod@3.22.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: unknown) => {
  console.log(`[FUNCTION_NAME] ${step}`, details ? JSON.stringify(details) : '');
};

const RequestSchema = z.object({
  // Define input schema
});

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Started");
    
    // 1. Init Supabase
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 2. Auth
    const authHeader = req.headers.get("Authorization");
    const { data: { user }, error } = await supabase.auth.getUser(
      authHeader?.replace("Bearer ", "")
    );
    if (error || !user) throw new Error("Unauthorized");
    
    // 3. Validate input
    const body = await req.json();
    const input = RequestSchema.parse(body);
    
    // 4. Business logic
    
    // 5. Return response
    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
    
  } catch (error) {
    logStep("ERROR", { message: error.message });
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
```

### Version Pinning

Always pin Deno imports:
```typescript
// ✅ Good - pinned version
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

// ❌ Bad - unpinned
import { serve } from "https://deno.land/std/http/server.ts";
```

## Component Guidelines

### Form Components

```typescript
// Use react-hook-form with Zod validation
const form = useForm<FormData>({
  resolver: zodResolver(formSchema),
  defaultValues: { ... },
});

// Handle submission
const onSubmit = async (data: FormData) => {
  try {
    await mutation.mutateAsync(data);
    toast.success("Saved successfully");
  } catch (error) {
    toast.error("Failed to save");
  }
};
```

### Loading States

```typescript
if (loading) {
  return <Skeleton className="h-32 w-full" />;
}

if (error) {
  return <Alert variant="destructive">Failed to load</Alert>;
}

return <div>{/* content */}</div>;
```

### Toast Notifications

```typescript
import { toast } from "sonner";

// Success
toast.success("Match created successfully");

// Error
toast.error("Failed to join match");

// With action
toast("Match starting soon", {
  action: {
    label: "View",
    onClick: () => navigate(`/match/${matchId}`),
  },
});
```

## Security Checklist

Before submitting PR:

- [ ] Input validated on client AND server
- [ ] No secrets in code (use env vars)
- [ ] RLS policies cover new tables/operations
- [ ] Admin operations verify role server-side
- [ ] Error messages sanitized (no internal details)
- [ ] SQL injection prevented (parameterized queries)
- [ ] Audit logging for sensitive operations

## Performance Checklist

- [ ] Use React Query for data fetching
- [ ] Implement loading states
- [ ] Lazy load heavy components
- [ ] Debounce expensive operations
- [ ] Add appropriate database indexes
- [ ] Minimize re-renders (useMemo, useCallback)

## Accessibility Checklist

- [ ] Semantic HTML elements
- [ ] ARIA labels on interactive elements
- [ ] Keyboard navigation works
- [ ] Color contrast meets WCAG AA
- [ ] Focus indicators visible
- [ ] Form labels associated with inputs
