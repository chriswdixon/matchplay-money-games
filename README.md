# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/ee724790-b6a2-42bc-a161-2b6b4394d6d0

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/ee724790-b6a2-42bc-a161-2b6b4394d6d0) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/ee724790-b6a2-42bc-a161-2b6b4394d6d0) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/tips-tricks/custom-domain#step-by-step-guide)

## PWA / Service Worker support — removed

This app **no longer ships any Progressive Web App (PWA) or service-worker
functionality**. The previous `vite-plugin-pwa` + Workbox setup, the
`/install` route, the install prompt UI, the web app manifest, and all
related icons have been intentionally removed.

### Why it was removed

- The service worker cached responses inside the Lovable preview iframe,
  serving stale builds and breaking navigation.
- The install prompt added confusion for users who only need the web app.
- Maintaining a separate offline cache layer was no longer worth the
  complexity now that the app is online-first.

### What this means in practice

- There is no `manifest.webmanifest` / `manifest.json`, no `sw.js`, no
  `registerSW.*`, and no `dev-dist/` Workbox output in the repo.
- `/install` (and any sub-path) redirects to the **NotFound** page via a
  `<Navigate to="/404" replace />` route guard in `src/App.tsx`.
- The runtime no longer attempts to register a service worker. Returning
  visitors who installed the old SW will have it evicted naturally the
  next time their browser revalidates the page (no SW = nothing to update).
- `index.html` no longer ships PWA meta tags (`apple-mobile-web-app-*`,
  `apple-touch-icon`, `mask-icon`, manifest `<link>`).

### CI guard — `.github/workflows/no-pwa.yml`

A dedicated GitHub Actions workflow (`No PWA Reintroduction`) runs on
every PR and every push to `main` and **fails the build** if any of the
following are reintroduced:

**Forbidden files / paths**
- `dev-dist/` (Workbox build output)
- `public/pwa-192x192.png`, `public/pwa-512x512.png`
- `public/manifest.json`, `public/manifest.webmanifest`,
  `public/site.webmanifest`
- `public/sw.js`, `public/service-worker.js`
- `src/components/PWAUpdatePrompt.tsx`
- `src/components/InstallPrompt.tsx`
- `src/pages/Install.tsx`
- Any `service-worker.*`, `registerSW.*`, or `*.webmanifest` file under
  `src/` or `public/`

**Forbidden source references** (scanned across `*.ts`, `*.tsx`, `*.js`,
`*.jsx`, `*.mjs`, `*.cjs`, `*.json`, `*.html`, excluding `node_modules`,
`dist`, lockfiles, and the workflow itself)
- `vite-plugin-pwa`
- `VitePWA(` invocations
- `workbox-window`, `workbox-build`, `workbox-core`, `workbox-precaching`,
  `workbox-routing`, `workbox-strategies`
- `navigator.serviceWorker.register`
- `registerSW`

**Forbidden dependencies in `package.json`**
- `vite-plugin-pwa`
- Any `workbox-*` package

If you have a legitimate reason to reintroduce a service worker (e.g.
true offline support outside the Lovable preview), update the guard
workflow in the same PR and document the rationale here.

