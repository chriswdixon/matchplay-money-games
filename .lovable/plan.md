## Plan

1. **Fix the stale Lovable preview permanently**
   - Remove the production app-shell service worker registration path that can keep serving old HTML/chunks in previews.
   - Stop `vite-plugin-pwa` from generating/registering `/sw.js` for this release.
   - Ship same-path kill-switch workers at both `/sw.js` and `/service-worker.js` so browsers that already registered either path unregister and clear the old app-shell caches.
   - Remove the custom reload/version-polling cache hacks that can fight with preview updates.
   - Keep home-screen metadata/icons via the existing manifest where possible, but no offline app-shell caching until/unless we rebuild it safely later.

2. **Add card brand logos**
   - Add a reusable accessible `CardBrandLogos` component using inline SVG/logomark-style badges for Visa, Mastercard, American Express, and Discover.
   - Display it in the public membership/pricing payment reassurance area and in the signup payment/setup flow where payment acceptance is described.
   - Keep wording neutral and aligned with the current site; no private card data is stored in the app.

3. **Add an age verification gate**
   - Reuse existing `profiles.age_verified`, `age_verified_at`, DOB signup validation, and `/verify-age` email-token flow.
   - Add a global authenticated-user age gate component near the existing overlays.
   - If a logged-in user is not age verified, block app actions behind a full-screen gate with status text and a route-safe CTA.
   - Allow essential routes through: `/auth`, `/verify`, `/verify-age`, `/terms`, `/privacy`, `/faq`.
   - For users with DOB already proving 18+, provide a direct confirmation action that marks them verified; otherwise instruct them to complete verification.

4. **Validate**
   - Check the updated file contents for the service-worker paths and gate placement.
   - Run targeted tests or a focused dev-server signal check if available after implementation.
   - Confirm the visible card logos and age gate behavior in the preview once build mode is enabled.