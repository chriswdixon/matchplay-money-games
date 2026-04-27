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

## CI

`.github/workflows/visual-regression.yml` runs `bun run test:visual` on every
PR and push to `main`. Snapshot drift fails the build. The HTML report and
any diff PNGs are uploaded as workflow artifacts (`playwright-report`,
`visual-diffs`) — download them from the failed run's summary page to see
exactly what changed.

When you intentionally change a covered screen:

1. `bun run test:visual:update` locally (or pull the artifact from CI and
   replace the baselines)
2. Commit the updated PNGs under `tests/visual/**/__screenshots__/`
3. Push — CI re-runs against the new baselines

Auth-gated specs are skipped in CI by default. To enable them, add
`PLAYWRIGHT_TEST_EMAIL`, `PLAYWRIGHT_TEST_PASSWORD`, `PLAYWRIGHT_ADMIN_EMAIL`,
`PLAYWRIGHT_ADMIN_PASSWORD`, and `PLAYWRIGHT_MATCH_ID` as repo secrets and
uncomment the matching `env:` lines in the workflow.

### On-demand baseline refresh from CI

Don't have a Linux box handy? Trigger the baseline regeneration from GitHub:

1. **Actions → Visual Regression → Run workflow**
2. Tick **`update_baselines`** and run on the branch you want to update
3. The job runs `bun run test:visual:update` and opens a PR titled
   *"chore(visual): refresh snapshot baselines"* containing only the new PNGs
4. Review the diff in the PR (every changed snapshot is visible inline) and
   merge to adopt

This requires the default `GITHUB_TOKEN` to have `contents: write` and
`pull-requests: write` (already configured on the job). If your repo
restricts Actions from creating PRs, enable it under
**Settings → Actions → General → Workflow permissions**.

### Nightly schedule

A cron trigger (`0 7 * * *` UTC) runs the full suite against `main` every
night. This catches gradual drift that a code-change-triggered run would
miss — font fallback shifts, CDN image re-encoding, transitive dep updates.

When a nightly run fails, the workflow opens (or comments on) a GitHub
issue labeled `visual-regression,nightly` with a link to the artifacts so
you can triage without having to watch the Actions tab.

## Per-screen diff thresholds

`tests/visual/thresholds.ts` defines three presets — `strict`, `default`,
`relaxed` — controlling `maxDiffPixelRatio`, `maxDiffPixels`, and per-pixel
`threshold`. Specs pick a preset by name; numbers live in one place.

| Preset | Use for | Pixel ratio | YIQ tolerance |
|---|---|---|---|
| `strict` | Brand surfaces (hero, gradient headings) | 0.1% | 0.1 |
| `default` | Most public routes | 1% | 0.2 |
| `relaxed` | Avatars, charts, generated content | 3% | 0.25 |

```ts
// Full page, default tolerance
await snapshot(page, "privacy");

// Stricter, element-scoped
await snapshotElement(hero, "hero", { preset: "strict" });

// Looser for noisy admin tables
await snapshot(page, "admin", { preset: "relaxed" });
```

If a screen flakes, prefer hiding the volatile node (`data-volatile`)
before loosening the preset.

### PR comments

On every PR run, the workflow posts a sticky comment summarizing failures:
- **🚨 Homepage hero regressions** are surfaced in their own table at the top
- Other failed snapshots are collapsed in a `<details>` block
- The comment links to the `playwright-report` HTML artifact (side-by-side
  diffs) and the per-shard `visual-diffs-shard-*` PNGs
- The comment is updated in place across re-runs — no thread spam
