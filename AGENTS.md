# AGENTS.md - Project Configuration for Clonk
<!-- KEEP THIS FILE UNDER ~80 LINES - operational only -->

## Tech Stack
React 19 + TypeScript ~5.8.2 + Vite ^6.2.0 + Tailwind CSS v4 (`@tailwindcss/vite`) + Firebase ^12.11.0 (→ Supabase migration) + React Router DOM ^7.13.1
Key deps: `motion@^12.38.0` (import from `motion/react`), `lucide-react@^0.546.0`, `clsx@^2.1.1`+`tailwind-merge@^3.5.0` → `cn()`, `@google/genai@^1.29.0`, `@supabase/supabase-js@^2.101.1`, `express@^4.21.2` (future MCP server — not yet used), `supabase@^2.84.10` (CLI, devDep)

## Build Commands
```
npm run dev       # Vite dev server → http://localhost:3000 (host 0.0.0.0)
npm run build     # Vite production build → dist/
npm run lint      # tsc --noEmit (type-check only, no ESLint)
npm run clean     # rm -rf dist
npm run preview   # preview production build
```
No tests configured. No ESLint configured.

## Project Structure
```
src/
  App.tsx              # BrowserRouter routes + auth guards + TutorialGuide overlay (5-step)
  main.tsx / firebase.ts / types.ts / constants.ts / index.css
  components/
    UI.tsx             # Exports: cn(), Avatar (xs/sm/md/lg/xl/2xl), Button (primary/secondary/ghost/danger/outline; sm/md/lg), Card
    AppLayout.tsx      # Authenticated layout: sidebar (desktop) + bottom nav (mobile)
    BottomNav.tsx / Sidebar.tsx / ErrorBoundary.tsx
  context/
    UserContext.tsx    # useUser() → { user, loading, signIn, signOut, updateUser, membership, updateMembership, cancelMembership, preferences, togglePreference }
  lib/
    supabase.ts        # createClient<Database>(url, key, { flowType:'pkce', autoRefreshToken, persistSession, detectSessionInUrl })
    database.types.ts  # Hand-written empty Database scaffold — overwritten by `supabase gen types typescript`
  pages/               # 11 pages: AdminDashboardPage, ChatPage, ConnectionsPage, FeedPage, MembershipPage, OnboardingPage, PersonalInfoPage, ProfilePage, ResourceDetailPage, ResourcesPage, SettingsPage
  services/
    seedService.ts     # Seeds Firestore with demo data
supabase/
  config.toml          # project: decarb-connect, PG v17, API:54321, DB:54322, Studio:54323, auth: Google+LinkedIn OIDC enabled
specs/                 # Authoritative SDK reference docs — READ BEFORE implementing:
                       # supabase-client, supabase-auth, supabase-storage, supabase-schema-migrations,
                       # supabase-migration-database, supabase-edge-functions, supabase-linkedin-oidc,
                       # shadcn-ui, mcp-typescript-sdk, anthropic-claude-sdk, react-router-v7, decarb-connect-v2
```
Config: `vercel.json` (SPA rewrite `/*→/index.html`), `firebase-applet-config.json` (committed), `IMPLEMENTATION_PLAN.md`, `TECHNOLOGY_CHOICES.md`

## Architecture
Pure SPA, no server. Currently Firebase (Auth popup, Firestore custom-DB-ID, Storage). Migrating to Supabase (Postgres+RLS, Auth w/ Google+LinkedIn OIDC, Storage). Vercel serves `index.html` for all routes. Global state via `UserContext`/`useUser()`. Onboarding persisted in localStorage+Firestore (localStorage authoritative). Future: Claude AI+MCP server for admin, shadcn/ui for admin UI.

## Migration Status (Phase 2 — IN PROGRESS)
- ✅ P2.1–P2.3: Supabase CLI init, client (`src/lib/supabase.ts` PKCE), typed Database scaffold
- ⏳ P2.4b+: `supabase start` (Docker), then 8 migrations: profiles, posts, post_likes, post_comments, resources, saved_resources, messages, connections
- ⏳ P2.5–P2.15: Schema migrations → `supabase gen types typescript` → seed.sql
- ⏳ P2.16–P2.38: Storage, Auth swap, service layer, Firebase removal
- ⏳ Phase 3: Event schedule feature (events, bookmarks, checkins, Q&A)
- ⏳ Phase 4: Admin dashboard rebuild + MCP server + shadcn/ui

## Existing Features & Routes
- `/connections` (default) — Browse/match attendees, messaging entry point (swipe + conversations + filters tabs)
- `/feed` — Social posts: likes, comments, edit/delete (real-time Firestore)
- `/chat/:userId` — DM with file attachments + voice notes (renders OUTSIDE AppLayout)
- `/resources`, `/resources/:id` — Library: videos/reports/insights, search/filter
- `/profile`, `/profile/:userId` — View/edit profile, connection status, social links
- `/profile/settings`, `/profile/personal`, `/profile/membership` — Settings sub-pages
- `/admin` — Admin dashboard (isAdmin guard via `AdminLayout`); `*` → redirects to `/connections`
- `/onboarding` — 5-step onboarding flow for new users, followed by TutorialGuide overlay

## Code Patterns
- Pages: `PascalCasePage.tsx` in `src/pages/`; functional components only
- Class merging: always `cn()` from `@/components/UI` (never raw clsx or twMerge)
- Animations: import `motion` from `motion/react` (NOT `framer-motion`)
- Path alias: `@/` → `./src/` (vite.config.ts + tsconfig.json)
- Icons: `lucide-react`, sized `w-5 h-5`
- Tailwind tokens: `bg-primary-accent` (lime `#c6ee62`), `bg-background` (navy `#020617`), `bg-surface-container-low/high`, `text-on-surface`, `text-on-surface-variant`
- Fonts: `font-sans` (Plus Jakarta Sans), `font-display` (Space Grotesk); `.glass-effect` for frosted glass panels

## Dev Server & Environment
```bash
npm run dev   # → http://localhost:3000
```
`.env.local` required: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (app throws at import if missing), `GEMINI_API_KEY`.
Firebase config in `firebase-applet-config.json` (committed — custom DB ID set there).
Pending vars: `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, `LINKEDIN_CLIENT_ID/SECRET`.
HMR: disable via `DISABLE_HMR=true`. Supabase Studio: http://localhost:54323 (requires `supabase start`).

## Patterns Discovered
<!-- Clonk appends patterns here as it learns -->
- SQL functions that query a table (e.g. `is_admin()` → `profiles`) must be defined AFTER that table's CREATE TABLE — place them in the same migration as the table, not in a shared utility migration

## Gotchas
- Onboarding: stored in **both** localStorage (`onboarded_{uid}`) AND Firestore — localStorage is authoritative; locked in React state via `localOnboarded` so it can never flip back once set
- Tutorial: tracked separately in localStorage as `tutorial_done_{uid}` — shown after onboarding completes
- `motion` must import from `motion/react`, NOT `framer-motion`
- Tailwind v4: `@theme` directive in `index.css`, no `tailwind.config.js` exists
- Firebase uses **custom database ID** (not `(default)`) — set in `firebase-applet-config.json`
- `npm run lint` = TypeScript type-check only, no ESLint
- `database.types.ts` is a hand-written empty scaffold — will be overwritten by `supabase gen types typescript` after first migration
- No `supabase/migrations/` directory yet
- `specs/` files are authoritative SDK references — read before implementing Supabase/shadcn/MCP/Anthropic features
- `express` is in prod dependencies (not devDeps) — reserved for future MCP server, not currently used in the Vite SPA
