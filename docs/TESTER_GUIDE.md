# LinkUp — Tester UX Checklist

A complete manual QA guide for verifying UX across **desktop browsers**, **mobile browsers**, and the **installed PWA** (iOS & Android). Work through each section and record pass/fail with screenshots.

---

## 0. Test Environments

| Environment | URL |
|---|---|
| Production | https://match-play.co |
| Preview | https://matchplay-money-games.lovable.app |

### Devices to cover
- **Desktop**: Chrome, Safari, Firefox, Edge — at 1920×1080 and 1366×768
- **Mobile web**: iOS Safari (iPhone), Android Chrome (Pixel/Samsung) — portrait + landscape
- **Tablet**: iPad Safari, Android tablet Chrome
- **PWA installed**: iOS "Add to Home Screen", Android "Install app"

### Test accounts
- Use emails of the form `qa+<scenario>@<your-domain>` so they're easy to clean up.
- Need at least: 1 fresh user, 1 user with completed matches, 1 admin, 1 user with active match, 1 user from a geo-blocked US state (use VPN).

> ⚠️ **Play money only** — no real payments exist. Starting balance is $500. Never expect Stripe checkout.

---

## 1. First Visit / Anonymous UX

### 1.1 Landing page (`/`)
- [ ] Hero loads within 2s, no layout shift (LCP image has `fetchpriority="high"`)
- [ ] Theme switcher (light/dark) works and persists after refresh (key: `linkup-theme`)
- [ ] All nav links work; footer brand reads **"MatchPlay"** (intentional exception); rest of app says **"LinkUp"**
- [ ] No gambling terminology anywhere ("entry fees", "prizes", "competitive gaming" only)
- [ ] H1 present, meta title <60 chars, meta description <160 chars

### 1.2 Cookie consent (GDPR)
- [ ] Banner appears on first visit
- [ ] "Accept", "Reject", "Customize" all work
- [ ] Choice persists in `localStorage` (`linkup-cookie-consent`)
- [ ] No `user_agent` is collected (verify via Network tab)
- [ ] Banner does **not** reappear after a choice

### 1.3 Geo-blocking
- [ ] From an allowed region: site loads normally
- [ ] From a blocked US state (VPN): full-screen overlay shown, app inaccessible
- [ ] Admin can add/remove a state in Admin → Geo-Blocking and the change takes effect on next reload

### 1.4 Public pages
- [ ] `/terms`, `/privacy`, `/install` render correctly
- [ ] 404 (`/asdf`) shows NotFound page
- [ ] Deep-link refresh works (e.g., refresh `/profile` while logged out → redirects)

---

## 2. Authentication

### 2.1 Sign up
- [ ] Email + password sign up sends confirmation email
- [ ] EmailConfirmationBanner appears until confirmed
- [ ] `/verify` page accepts the link
- [ ] Age verification (`/verify-age`) blocks under-18 with email attestation
- [ ] After confirm: redirected to home, $500 play money credited

### 2.2 Sign in
- [ ] Wrong password → clear error, no account info leaked
- [ ] Correct password → lands on home, session persists across refresh
- [ ] MFA (if enrolled) prompts for code; invalid code rejected
- [ ] Forgot password → reset email arrives → `/auth/reset-password` works

### 2.3 Sign out
- [ ] Sign out clears session and redirects to `/`
- [ ] Protected routes (`/profile`, `/admin`, `/create-match`) redirect to auth when logged out

---

## 3. Profile

- [ ] Avatar upload works (jpg/png), preview updates immediately
- [ ] Public profile fields editable (name, handicap)
- [ ] Private fields gated behind `get_user_private_data()` — other users cannot see them
- [ ] Handicap calculator: Course Handicap form has **no Slope Rating field** (uses 113)
- [ ] Transaction history shows all play-money entries with correct signs
- [ ] GDPR settings: "Export my data" downloads JSON; "Delete account" creates a deletion request
- [ ] MFA enrollment + disenrollment work
- [ ] Payment Methods section is **absent or disabled** (Stripe removed)

---

## 4. Match Lifecycle

### 4.1 Create match (`/create-match`)
- [ ] Blocked if user has an incomplete match — clear message shown
- [ ] Course search returns results from golfcourseapi.com
- [ ] Tee box selector shows yardage indicators
- [ ] Match size: **Match Play = 2**, **Team = 4**, **Stroke Play = manual**
- [ ] ToggleGroup (not Tabs) used for binary choices (e.g., 9/18 holes)
- [ ] Entry fee deducted from play-money balance on create
- [ ] On mobile: form submission is controlled (no double-submit)

### 4.2 Join match
- [ ] Open matches visible in MatchFinder, ordered with active/incomplete prioritized
- [ ] Color-coded urgency banner shown for matches needing attention
- [ ] PIN-protected matches require correct PIN; PIN not visible in any API response (column-level revoked)
- [ ] Team match shows TeamJoinDialog
- [ ] Joining deducts entry fee

### 4.3 Play / score
- [ ] Scorecard supports 9 and 18 holes
- [ ] Live sync between players (open in 2 browsers)
- [ ] Offline scoring: disable network → scores queue → reconnect → sync
- [ ] "Finish the Match" button appears when player completes their card
- [ ] 24h auto-finalize after last score entered

### 4.4 Complete & rate
- [ ] Winnings credited (entry pool minus fee)
- [ ] PlayerRatingDialog appears post-match; star rating saves
- [ ] MatchResultsDisplay shows correct standings

### 4.5 Cancel / leave
- [ ] "Leave Match" button styled identically to "Start Match"
- [ ] Cancellation refunds entry fee minus $2
- [ ] Admin can review cancellations in Admin → Cancellations

---

## 5. Admin Console (`/admin`)

Sign in as admin and verify each tab:

- [ ] **Users** — list, disable, magic link, password reset
- [ ] **Matches** — bulk delete; deleted matches set to `cancelled` and refund minus fee
- [ ] **Cancellation Reviews** — approve/deny works
- [ ] **Incomplete Match Reviews** — flag job ran (check `flag-incomplete-matches` logs)
- [ ] **Deletion Requests** (GDPR) — process & confirm deletion
- [ ] **Geo-Blocking** — add/remove state, takes effect immediately
- [ ] **Coupons** — create, list, redeem
- [ ] **Invites** — request invites flow
- [ ] **Golf Courses** — import, enrich, export all
- [ ] **Social Links / Platform URLs** — Ayrshare config persists in localStorage
- [ ] **Audit Log** — records admin actions; alerts for suspicious activity
- [ ] **Reporting** — charts render

Non-admin users hitting `/admin` are redirected.

---

## 6. Responsive / Mobile UX

Test at 320, 375, 414, 768, 1024, 1366, 1920px widths.

### 6.1 Layout
- [ ] No horizontal scroll at any width
- [ ] Match cards use full width with `px-3` padding on mobile
- [ ] Mobile nav `SheetContent` max-width is `calc(100vw - 2rem)` — never overlaps screen edge
- [ ] BottomTabBar visible only on mobile, hidden on desktop
- [ ] Tap targets ≥ 44×44 px
- [ ] Modals/sheets dismissible via backdrop tap and X button

### 6.2 Forms
- [ ] Correct keyboard types (email, numeric for fees, tel for PIN)
- [ ] No zoom-on-focus on iOS (input font-size ≥ 16px)
- [ ] Date/time pickers usable with thumb

### 6.3 Landscape
- [ ] Hero, scorecard, and match list usable in landscape on phone

---

## 7. Accessibility (WCAG 2.1 AA)

- [ ] Skip-to-content link works (Tab from page top)
- [ ] All text ≥ 4.5:1 contrast in both themes (use axe DevTools)
- [ ] Focus rings visible on every interactive element
- [ ] All images have meaningful `alt` (or empty alt for decorative)
- [ ] Form fields have associated labels
- [ ] Dialogs trap focus and restore on close
- [ ] Screen reader (VoiceOver / TalkBack) announces nav, match cards, score updates
- [ ] No color-only signaling (urgency banners also use icons/text)
- [ ] Reduced-motion preference respected

Run `axe DevTools` on: `/`, `/auth`, `/profile`, `/create-match`, a match detail page, `/admin`. **0 violations expected.**

---

## 8. PWA Installation & Behavior

### 8.1 Install — iOS Safari
- [ ] Visit production URL → tap Share → "Add to Home Screen"
- [ ] App icon appears with correct LinkUp branding
- [ ] Launch from home screen → opens standalone (no Safari chrome)
- [ ] Status bar styling looks correct (no white gap at top)

### 8.2 Install — Android Chrome
- [ ] Browser shows "Install app" prompt or menu item
- [ ] After install, app appears in launcher
- [ ] Splash screen shows brand color + icon
- [ ] Standalone display mode (no URL bar)

### 8.3 PWA runtime
- [ ] Sign in persists between launches
- [ ] OAuth callback (`/~oauth`) **always hits network** — verify by signing in with Google after install
- [ ] Pull-to-refresh disabled inside app shell (or behaves gracefully)
- [ ] Deep links from external sources (email confirmation) open the PWA on Android
- [ ] iOS opens deep links in Safari (known iOS limitation) — banner suggests opening in PWA

### 8.4 Update flow
- [ ] Deploy a new version → existing PWA shows update toast within ~1 minute
- [ ] Tapping "Update" reloads with the new version (skip-waiting)
- [ ] Dismissing the toast does not break navigation

### 8.5 Offline
- [ ] Enable airplane mode → OfflineIndicator appears
- [ ] Cached pages still navigable
- [ ] Score entries queue locally and sync when reconnected
- [ ] No infinite spinners; failed fetches show clear error UI

### 8.6 Permissions
- [ ] Location prompt only requested when needed (e.g., "Games near you")
- [ ] Denying location does not crash the page

---

## 9. Performance

Use Chrome DevTools → Lighthouse (Mobile, Slow 4G, 4× CPU throttle).

| Metric | Target |
|---|---|
| Performance score | ≥ 85 |
| LCP | < 2.5s |
| CLS | < 0.1 |
| INP | < 200ms |
| TBT | < 300ms |

- [ ] Route-level code splitting confirmed (Network tab shows lazy chunks per route)
- [ ] Preconnect to Supabase domain present in `<head>`
- [ ] Images compressed; no >500 KB image on initial load

---

## 10. Security spot-checks (visible to QA)

- [ ] Match PINs never appear in any network response payload
- [ ] GraphQL/REST anon requests to protected tables return empty, not data
- [ ] Profile pictures bucket: public read OK (intentional)
- [ ] `temp-social-media` bucket: not publicly listable
- [ ] Logging out invalidates the session for further API calls
- [ ] CSP / no mixed content warnings in console

---

## 11. Regression smoke test (run before every release)

1. Sign up new user → confirm email → land on home with $500
2. Create a 2-player Match Play with another browser
3. Both players enter scores for 9 holes → finalize → winner credited
4. Rate opponent → check transaction history
5. Install PWA on phone → repeat steps 2–4 inside the PWA
6. Sign in as admin → verify the match appears in Match Management
7. Toggle dark mode → reload → still dark
8. Run Lighthouse on `/` (mobile) → score ≥ 85

---

## 12. Reporting bugs

For each issue include:

- Environment (URL, browser + version, OS, viewport, PWA y/n)
- Steps to reproduce (numbered)
- Expected vs actual
- Screenshot or screen recording
- Console + network errors (if any)
- Account email used (so we can inspect server-side)

File against the relevant area: **Auth · Match · Admin · PWA · A11y · Perf · Security**.
