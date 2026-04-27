/**
 * Per-screen visual diff thresholds.
 *
 * Playwright's `toHaveScreenshot` accepts:
 *   - `maxDiffPixelRatio` — max fraction of pixels allowed to differ (0..1)
 *   - `maxDiffPixels`     — absolute upper bound, useful as a floor on tiny
 *                            elements where 1% of a 200x100 region is only
 *                            200px and a single AA artifact can blow it
 *   - `threshold`         — per-pixel YIQ tolerance (0..1, default 0.2)
 *
 * Conventions used here:
 *   - `strict`   — brand-critical surfaces (hero, headings with gradients).
 *                  Catches color/gradient swaps the human eye notices.
 *   - `default`  — most public routes. Tolerates browser AA fluctuations
 *                  (font hinting, sub-pixel layout) without false positives.
 *   - `relaxed`  — content-heavy or image-heavy screens (admin tables,
 *                  scorecard with avatars) where larger pixel churn is
 *                  expected from real data noise.
 *
 * Tighten / loosen by editing this single file. Specs do not hard-code
 * numbers — they pass a preset name to `snapshot()` / `snapshotElement()`.
 */
export type ThresholdPreset = "strict" | "default" | "relaxed";

export interface ThresholdConfig {
  maxDiffPixelRatio: number;
  maxDiffPixels?: number;
  threshold?: number;
}

export const THRESHOLDS: Record<ThresholdPreset, ThresholdConfig> = {
  strict: {
    // 0.1% of pixels may differ; per-pixel YIQ tolerance halved vs default.
    // A gradient hue shift on the hero will exceed this; AA noise won't.
    maxDiffPixelRatio: 0.001,
    maxDiffPixels: 50,
    threshold: 0.1,
  },
  default: {
    // Matches the project-wide default in playwright.config.ts.
    maxDiffPixelRatio: 0.01,
    maxDiffPixels: 500,
    threshold: 0.2,
  },
  relaxed: {
    // Allow up to 3% pixel churn for screens with avatars, charts, or
    // generated content. Use sparingly — prefer hiding volatile nodes
    // with `data-volatile` instead.
    maxDiffPixelRatio: 0.03,
    maxDiffPixels: 2000,
    threshold: 0.25,
  },
};
