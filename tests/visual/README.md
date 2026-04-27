# Visual Regression Tests

Pixel-diff screenshots of major screens across themes and breakpoints, powered
by [Playwright](https://playwright.dev/).

## What's covered

| Spec | Routes | Auth |
|---|---|---|
| `public-routes.spec.ts` | `/`, `/linkup`, `/auth`, `/privacy`, `/terms` | none |
| `authenticated.spec.ts` | `/` (dashboard), `/create-match`, `/profile`, `/admin` | yes |
| `authenticated.spec.ts` | `/match/:id` (scorecard) | yes + match id |

Each spec runs in 5 projects: `desktop-light`, `desktop-dark`, `tablet-light`,
`mobile-light`, `mobile-dark` (see `playwright.config.ts`).

## First run

```bash
bunx playwright install chromium webkit
bun run test:visual:update   # generate baselines
bun run test:visual          # diff against baselines
bun run test:visual:report   # open HTML report (diffs highlighted)
```

Baselines are committed next to specs in `__screenshots__/<spec>/<name>-<project>.png`.
They are **platform-specific** — generate them on the OS your CI runs on
(typically Linux) and commit those.

## Auth-gated specs

Authenticated specs are skipped unless these env vars are set:

```
PLAYWRIGHT_TEST_EMAIL=...
PLAYWRIGHT_TEST_PASSWORD=...
PLAYWRIGHT_ADMIN_EMAIL=...        # for /admin
PLAYWRIGHT_ADMIN_PASSWORD=...
PLAYWRIGHT_MATCH_ID=<uuid>        # for /match/:id scorecard
```

Use **dedicated test accounts** — these specs sign in for real.

## Running against a deployed URL

```bash
PLAYWRIGHT_BASE_URL=https://match-play.co bun run test:visual
```

When `PLAYWRIGHT_BASE_URL` is set, Playwright skips the local dev server.

## Determinism

`tests/visual/helpers.ts` disables animations/transitions, hides toasts and
elements marked `[data-volatile]`, freezes the caret, and waits for fonts +
network idle before snapshotting. If a screen is flaky, mark unstable nodes
with `data-volatile` (e.g. live timers, randomized avatars).

## Updating baselines

After an intentional UI change:

```bash
bun run test:visual:update
```

Review the diff in the PR before merging.
