# MatchPlay Developer Documentation

Welcome to the MatchPlay developer documentation. This guide is designed to help developers understand, maintain, and extend the MatchPlay competitive golf platform.

## Quick Start

```bash
# Clone the repository
git clone <YOUR_GIT_URL>

# Install dependencies
npm install

# Start development server
npm run dev
```

## Documentation Index

| Document | Description |
|----------|-------------|
| [Architecture](./ARCHITECTURE.md) | System design, technology stack, and component structure |
| [Database](./DATABASE.md) | Schema, relationships, RLS policies, and migrations |
| [Authentication](./AUTHENTICATION.md) | Auth flows, MFA, roles, and session management |
| [Edge Functions](./EDGE_FUNCTIONS.md) | Serverless functions, patterns, and deployment |
| [Features](./FEATURES.md) | Core feature implementations and business logic |
| [Security](./SECURITY.md) | Security practices, RLS, input validation |
| [Testing](./TESTING.md) | Testing strategies and debugging |
| [Contributing](./CONTRIBUTING.md) | Code standards, PR process, and conventions |

## Technology Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, TypeScript, Vite |
| UI | Tailwind CSS, shadcn/ui, Radix UI |
| State | TanStack Query (React Query) |
| Routing | React Router v6 |
| Backend | Supabase (PostgreSQL, Edge Functions) |
| Auth | Supabase Auth with MFA |
| Payments | Stripe Connect |
| PWA | Vite PWA Plugin, Workbox |

## Project Structure

```
├── docs/                    # Developer documentation
├── public/                  # Static assets
├── src/
│   ├── assets/             # Images, fonts
│   ├── components/         # React components
│   │   ├── admin/          # Admin-only components
│   │   ├── auth/           # Authentication components
│   │   ├── profile/        # Profile management
│   │   └── ui/             # shadcn/ui components
│   ├── hooks/              # Custom React hooks
│   ├── integrations/       # External service integrations
│   ├── lib/                # Utilities and helpers
│   └── pages/              # Route pages
├── supabase/
│   ├── functions/          # Edge Functions (Deno)
│   └── migrations/         # Database migrations
└── TECHNICAL_DOCUMENTATION.md  # Legacy detailed docs
```

## Key Concepts

### Match Lifecycle
```
Open → Started → Completed/Cancelled
```

### User Roles
- **User**: Default role, can create/join matches
- **Moderator**: Can review flagged content
- **Admin**: Full system access

### Financial Flow
```
Entry Fee → Player Account → Prize Distribution → Payout
```

## Environment Variables

### Required (Supabase)
- `VITE_SUPABASE_URL` - Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Supabase anonymous key

### Edge Function Secrets
- `STRIPE_SECRET_KEY` - Stripe API secret key
- `GOLFCOURSEAPI_KEY` - Golf Course API key
- `AYRSHARE_API_KEY` - Social media posting API key

## Common Tasks

### Adding a New Page
1. Create component in `src/pages/`
2. Add route in `src/App.tsx`
3. Add navigation link if needed

### Adding a New Edge Function
1. Create folder in `supabase/functions/`
2. Add `index.ts` with Deno handler
3. Deploy via Lovable or `supabase functions deploy`

### Modifying Database Schema
1. Create migration via Supabase dashboard or Lovable
2. Update RLS policies as needed
3. Types auto-generate to `src/integrations/supabase/types.ts`

## Getting Help

- [Supabase Documentation](https://supabase.com/docs)
- [shadcn/ui Components](https://ui.shadcn.com)
- [TanStack Query](https://tanstack.com/query)
- [Stripe API Reference](https://stripe.com/docs/api)
