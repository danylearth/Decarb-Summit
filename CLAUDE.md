# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

Decarb Connect — a networking app for industrial decarbonization summit attendees. Users can match/connect with other attendees, chat, browse a community feed, and access resources. Built as a single-page app deployed on Vercel.

Currently mid-migration from Firebase to Supabase (v2 overhaul). See `TECHNOLOGY_CHOICES.md` for selected technologies and `specs/` for detailed SDK reference docs (Supabase, shadcn/ui, MCP, Anthropic, React Router). Supabase project is initialized in `supabase/` (CLI config only — no migrations yet).

### Migration Status (Firebase → Supabase)
- **Phase 2.1–2.4a** (done): Supabase CLI initialized, client created (`src/lib/supabase.ts` with PKCE auth flow), typed DB scaffold (`src/lib/database.types.ts`), env vars in `.env.local`
- **Phase 2.4b–2.4c** (pending): Local Supabase start (Docker), Vercel env push
- **Phase 2.5–2.15** (pending): All DB schema migrations (no `supabase/migrations/` yet)
- **Phase 2.16–2.38** (pending): Storage, Auth swap, service layer, Firebase removal
- **Phase 3** (pending): Event schedule feature (events, bookmarks, checkins, Q&A)
- **Phase 4** (pending): Admin dashboard rebuild + shadcn/ui

The migration will add: Postgres + RLS, Supabase Auth (Google + LinkedIn OIDC), Supabase Storage, and shadcn/ui for admin UI. Claude AI + MCP server was removed from scope — admin moderation is manual.

## Commands

- `npm run dev` — start Vite dev server on port 3000 (host 0.0.0.0)
- `npm run build` — production build (Vite → `dist/`)
- `npm run preview` — preview production build
- `npm run lint` — type-check only (`tsc --noEmit`), no ESLint configured
- `npm run clean` — remove dist/

There are no tests configured.

## Architecture

**Stack:** Vite + React 19 + TypeScript 5.8 + Tailwind CSS v4 + Firebase 12 + React Router v7

**Backend:** Firebase only (no server). Auth (Google sign-in via popup), Firestore (user profiles, posts, comments, connections, messages), Storage (file uploads). Config loaded from `firebase-applet-config.json`. Firebase SDK initialized in `src/firebase.ts`. Uses a **custom Firestore database ID** (not the default `(default)`). Supabase client initialized in `src/lib/supabase.ts` (not yet wired into app — migration in progress). `database.types.ts` is a hand-written empty scaffold — will be overwritten by `supabase gen types typescript` after first migration.

**Routing:** React Router with `BrowserRouter`. Vercel `rewrites` in `vercel.json` sends all paths to `index.html`. Routes defined in `src/App.tsx`. Unauthenticated users see login screen. New users go through `/onboarding` flow, then a tutorial overlay, before reaching the main app. Chat page (`/chat/:userId`) renders outside the main layout.

**State:** `src/context/UserContext.tsx` is the central state provider — handles auth state, user profile (real-time Firestore listener), membership, and preferences. Accessed via `useUser()` hook. Onboarding completion is persisted in both Firestore and localStorage — localStorage is the authoritative source to prevent race conditions.

**Layout:** `AppLayout` wraps authenticated routes with a sidebar (desktop) and bottom nav (mobile). `AdminLayout` is a separate route guard component that checks `user.isAdmin` and redirects non-admins.

**Styling:** Tailwind v4 with `@tailwindcss/vite` plugin (no `tailwind.config.js` — uses `@theme` directive in `src/index.css`). Custom dark theme with key design tokens:
- `--color-background`: deep navy (`#020617`)
- `--color-primary-accent`: lime green (`#c6ee62`)
- Surface hierarchy: `surface-container-lowest` through `surface-container-highest`
- Fonts: Plus Jakarta Sans (body via `font-sans`), Space Grotesk (headings via `font-display`)
- `.glass-effect` utility for frosted glass panels

**Path alias:** `@/*` maps to `./src/*` (configured in both `tsconfig.json` and `vite.config.ts`).

**Mock data:** `src/constants.ts` contains mock users, posts, resources, and messages used as fallback/seed data. `src/services/seedService.ts` can seed Firestore with demo data.

## Key Patterns

- Class merging: always use `cn()` from `src/components/UI.tsx` (wraps `clsx` + `tailwind-merge`)
- Animations: `motion` package imported from `motion/react` (NOT `framer-motion`)
- Icons: `lucide-react`, typically sized `w-5 h-5`
- UI primitives: `src/components/UI.tsx` exports `cn()`, `Avatar`, `Button`, `Card`
- Pages: `PascalCasePage.tsx` in `src/pages/`, functional components only
- Tailwind classes use custom tokens: `bg-primary-accent`, `bg-surface-container-low`, `text-on-surface`, `text-on-surface-variant`

## Gotchas

- Onboarding state lives in **both** localStorage (`onboarded_{uid}`) and Firestore — localStorage is authoritative to prevent race conditions. Locked in React state via `localOnboarded` so it can never flip back once set.
- Tutorial tracking is separate: `tutorial_done_{uid}` in localStorage — shown after onboarding completes
- `motion` must be imported from `motion/react`, NOT `framer-motion`
- Tailwind v4 uses `@theme` directive in `index.css` — there is no `tailwind.config.js`
- Firebase uses a **custom database ID** (not `(default)`) — set via `firestoreDatabaseId` in `firebase-applet-config.json`
- `npm run lint` is TypeScript type-check only — no ESLint is configured
- No `supabase/migrations/` directory yet — all schema work is pending
- `specs/` files are authoritative SDK reference docs — read before implementing Supabase/shadcn features (not implementation specs)
- `express` is in prod dependencies (not devDeps) — reserved for future MCP server, not currently used in the Vite SPA
- SQL functions that query a table (e.g. `is_admin()`) must be defined AFTER that table's `CREATE TABLE` — place them in the same migration as the table
- Supabase docs default to `NEXT_PUBLIC_` prefix for env vars — this is a Vite project, so use `VITE_` prefix instead

## Environment

- `.env.local` required: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (app throws at import if missing), `GEMINI_API_KEY` (for AI features via `@google/genai`), `SUPABASE_SERVICE_ROLE_KEY`
- Firebase config in `firebase-applet-config.json` (committed)
- HMR can be disabled via `DISABLE_HMR=true` env var
- Pending env vars: `ANTHROPIC_API_KEY`, `LINKEDIN_CLIENT_ID`/`LINKEDIN_CLIENT_SECRET`
- Supabase local dev: Studio at `http://localhost:54323`, API at `54321`, DB at `54322` (requires `supabase start` with Docker)
