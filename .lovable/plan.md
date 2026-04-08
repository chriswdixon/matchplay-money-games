

## Rebrand from "MatchPlay" to "LinkUp"

### Scope
Replace all visible instances of "MatchPlay" with "LinkUp" across the entire codebase, **except** `AppFooter.tsx` (per your instruction). This includes UI text, meta tags, email templates, PWA config, and internal identifiers.

### Files to Update

**Frontend — Pages**
1. `src/pages/MatchPlayLanding.tsx` — Rename component to `LinkUpLanding`, update import
2. `src/pages/Index.tsx` — Update import to use new landing component name
3. `src/pages/Terms.tsx` — Replace ~15 instances of "MatchPlay" with "LinkUp"
4. `src/pages/Privacy.tsx` — Replace ~6 instances of "MatchPlay" with "LinkUp"
5. `src/pages/Install.tsx` — Replace ~7 instances
6. `src/pages/Profile.tsx` — "Manage your MatchPlay profile" → "Manage your LinkUp profile"
7. `src/pages/VerifyAge.tsx` — "full access to MatchPlay" → "full access to LinkUp"

**Frontend — Components**
8. `src/components/MatchPlayHero.tsx` — Rename component to `LinkUpHero`, update "Welcome to MatchPlay" → "Welcome to LinkUp", "Join MatchPlay" → "Join LinkUp"
9. `src/components/AppHeader.tsx` — `alt="MatchPlay"` → `alt="LinkUp"`
10. `src/components/AppFeatures.tsx` — "MatchPlay combines…" → "LinkUp combines…"
11. `src/components/InstallPrompt.tsx` — "Install MatchPlay" → "Install LinkUp"
12. `src/components/GeoBlockingOverlay.tsx` — `support@matchplay.golf` → update email
13. `src/components/CookieConsent.tsx` — `matchplay-cookie-consent` → `linkup-cookie-consent`
14. `src/components/auth/AuthForm.tsx` — "Welcome to MatchPlay" → "Welcome to LinkUp", "Install MatchPlay" → "Install LinkUp"
15. `src/components/profile/GDPRSettings.tsx` — Replace ~4 instances + download filename
16. `src/components/profile/ProfileDisplay.tsx` — "get the most out of MatchPlay" → "get the most out of LinkUp"
17. `src/components/admin/SocialPlatformUrls.tsx` — Update default social URLs from `matchplay` to `linkup`

**Config / HTML**
18. `index.html` — Update `<title>`, `apple-mobile-web-app-title`, `og:title`, `twitter:title`, `meta author`, all from "MatchPlay" to "LinkUp"
19. `src/main.tsx` — `storageKey: "matchplay-theme"` → `"linkup-theme"`
20. `src/lib/offlineDb.ts` — `DB_NAME: 'matchplay-offline'` → `'linkup-offline'`

**Edge Functions (Supabase)**
21. `supabase/functions/send-age-verification/index.ts` — All email content: "MatchPlay" → "LinkUp"
22. `supabase/functions/request-invite/index.ts` — Email from/subject/body: "MatchPlay" → "LinkUp"
23. `supabase/functions/verify-age-token/index.ts` — Success message
24. `supabase/functions/export-user-data/index.ts` — Download filename
25. `supabase/functions/search-golf-courses/index.ts` — User-Agent header

**Assets**
26. Regenerate `public/og-image.jpg` with "LinkUp" branding instead of "MatchPlay"

### What stays the same
- `src/components/AppFooter.tsx` — No changes (as requested)
- File/component references like `useActiveMatch`, `MatchFinder`, `MatchScorecard` etc. — these refer to golf matches, not the brand name

### Technical Notes
- Renaming `MatchPlayHero` → `LinkUpHero` and `MatchPlayLanding` → `LinkUpLanding` requires updating all import references
- The localStorage keys (`matchplay-theme`, `matchplay-cookie-consent`) and IndexedDB name (`matchplay-offline`) will change, which means existing users will lose their saved theme preference and cookie consent — this is expected for a rebrand
- Edge functions will need redeployment after changes

