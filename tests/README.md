# End-to-End Test Suite

Comprehensive test harness for the LinkUp / MatchPlay app. Three layers:

| Layer | Runner | Location | Mode |
|---|---|---|---|
| Frontend unit/component | Vitest + Testing Library | `src/**/*.test.{ts,tsx}` | mocks only |
| Edge functions | Deno test | `supabase/functions/_tests/edge/` | live (deployed functions) |
| RLS security | Deno test | `supabase/functions/_tests/rls/` | live (real auth users) |

## Running

```bash
# frontend (mocks)
bun run test
bun run test:coverage

# edge functions + RLS (live — creates real test users)
bun run test:edge
bun run test:rls
```

## Live tests — important

`test:edge` and `test:rls` create real auth users in Supabase project `rgdegvpfnilzkqpexgij`.
All test users use the prefix `e2e+` and email domain `@e2e.linkup.test`.
A teardown helper signs them out and best-effort deletes their data.

**Email confirmation must be disabled** in Supabase Auth settings (already confirmed off).

Some tables (audit logs, deletion requests) intentionally cannot be deleted by RLS; expect minor accumulation.

## Test counts

- Frontend: 90 tests across validation, utils, match validation, AuthProvider, MembershipTiers, HeroThemeSwitcher, AppFooter, StarRating
- Edge functions: ~40 tests (one per public function: happy + auth + invalid input)
- RLS: ~80 tests (cross-user denial across every protected table)

Total: ~210 automated assertions.

## Adding new tests

- Component: drop `Foo.test.tsx` next to `Foo.tsx` and use `renderWithProviders` from `@/test/utils/render`.
- Edge: add a `*_test.ts` under `supabase/functions/_tests/edge/` using `harness.ts` helpers.
- RLS: add to `supabase/functions/_tests/rls/policy_matrix_test.ts`.
