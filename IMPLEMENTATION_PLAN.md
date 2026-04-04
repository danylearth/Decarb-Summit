# Implementation Plan

<!-- Release: v2 — Supabase Platform Overhaul -->
<!-- Current Release: v2.4b–2.13d — Supabase Database Migration (8 tables) -->
<!-- Audience: Summit attendees (networking, scheduling, Q&A) + Admins (management via shadcn/ui dashboard) -->
<!-- Phases: Bug Fixes → Supabase Migration → Event Schedule → Admin Dashboard -->

---

## Phase 1: Bug Fixes (Current Firebase Stack)

> Fix user-facing bugs and DX issues before migration. Bugs inherently resolved by migration (N+1 queries, base64 avatars, unpersisted connections) are deferred to Phase 2.

### High Priority

- [x] **P1.1** ~~Fix route shadowing in App.tsx~~ — Verified: static routes (`/profile/settings`, `/profile/personal`, `/profile/membership`) already precede `/profile/:userId`. React Router v7 ranking algorithm ensures static segments beat dynamic params regardless of order. No change needed.
- [x] **P1.2** Add admin role guard to `/admin` route and Admin Dashboard link in SettingsPage — `AdminLayout` wrapper checks `user.isAdmin`, non-admins redirected to `/`. Settings link conditionally rendered.
- [x] **P1.3** Fix `@` path alias mismatch — aligned `tsconfig.json` paths from `./*` (project root) to `./src/*` to match `vite.config.ts` alias. No source files used the alias yet, so no import changes needed.
- [x] **P1.4** Fix PersonalInfoPage hardcoded email `'alex.sterling@decarb.global'` — now reads from `auth.currentUser.email` via Firebase auth import
- [x] **P1.5** Fix PersonalInfoPage `handleSave` — added `async`/`await` on `updateUser()` so Firestore write completes before navigating to `/profile`
- [x] **P1.6** Remove console.log statements from OnboardingPage (lines ~78, 81) and UserContext.tsx (lines ~175, 177) — removed debug logging from `handleFinish` and `updateUser`
- [x] **P1.7** Hide dev "Reset Onboarding" button in production in SettingsPage — gated behind `import.meta.env.DEV`, added `vite/client` types to `tsconfig.json`
- [x] **P1.8** Fix ResourceDetailPage hardcoded article body — render actual `resource.description` from Firestore instead of static content
- [x] **P1.9** Fix state update during render in App.tsx — moved `setLocalOnboarded(true)` from inline render into a `useEffect` to avoid React warning about state updates during render

### Low Priority (pre-migration)

- [x] **P1.10** Fix ProfilePage hardcoded location ("London, UK") and employment type ("Full-time") — removed hardcoded elements since no backing data exists in User type or onboarding flow
- [x] **P1.11** Remove `MOCK_RESOURCES` fallback from ResourcesPage — show proper empty state with icon and descriptive message instead of falling back to mock data
- [x] **P1.12** Fix ResourceDetailPage "Download PDF" button — removed non-functional button and unused `isReport` variable/`Download` import
- [x] **P1.13** Fix ChatPage date separator hardcoded as "Today" — computes actual date from message timestamps, groups by day with "Today"/"Yesterday"/full date labels
- [x] **P1.14** Audit and fix empty/loading/error states across pages — added ErrorBoundary component, try/catch on all Firestore reads, loading spinners, empty state messages, and error UI across all pages

---

## Phase 2: Supabase Migration (Fresh Start)

> Complete Firebase → Supabase replacement. No data migration — clean slate. Per specs/decarb-connect-v2.md.

### 2A: Foundation

- [x] **P2.1** Initialize Supabase project — `npx supabase init`, configure `config.toml` per specs/supabase-schema-migrations.md
- [x] **P2.2** Create `src/lib/supabase.ts` — Supabase client initialization with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` per specs/supabase-client.md. Use PKCE flow, auto-refresh tokens
- [x] **P2.3** Generate database types — `npx supabase gen types typescript` → `src/lib/database.types.ts` per specs/supabase-client.md
- [x] **P2.4a** Add env vars to `.env.local` — `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (done)
- [x] **P2.4b** Start local Supabase — `supabase start` (requires Docker). Verify Studio at `:54323`, confirm auth providers (Google, LinkedIn OIDC, email/password, magic link) are visible. Prerequisite for all migration tasks
- [x] **P2.4c** Push env vars to Vercel — `vercel env add` for `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (all envs), `SUPABASE_SERVICE_ROLE_KEY` (sensitive on prod/preview, regular on dev)

### 2B: Database Schema (migrations)

> All tables per specs/supabase-migration-database.md (authoritative schema). Each migration per specs/supabase-schema-migrations.md patterns.
> Column designs derive from specs/supabase-migration-database.md, cross-referenced with `src/types.ts` and Firestore usage in pages.
> Every `create table` must be followed by `alter table ... enable row level security` per specs/supabase-schema-migrations.md.
> Migration ordering: utilities first, then `profiles` (all other tables FK to it), then `posts` before `post_likes`/`post_comments`, `resources` before `saved_resources`.
> Use `(select auth.uid())` subquery form in all RLS policies for performance.
> Table name is `profiles` (not `users`) — mirrors Firestore `users` collection but avoids collision with `auth.users`.
> All primary keys are `uuid default gen_random_uuid()` except `profiles.id` (references `auth.users`) and junction tables (composite PKs).
> Tables with `updated_at` columns (`profiles`, `posts`, `post_comments`) must attach the `set_updated_at` trigger.

- [x] **P2.4d** Migration: utility functions — create `set_updated_at()` trigger function (sets `new.updated_at = now()` on UPDATE) and `is_admin()` helper function (returns `exists(select 1 from profiles where id = (select auth.uid()) and is_admin = true)`). Must be the first migration — all table migrations depend on these. Per specs/supabase-schema-migrations.md
- [x] **P2.5** Migration: `profiles` table — per specs/supabase-migration-database.md `profiles` section. Key columns: `id uuid PK references auth.users on delete cascade`, `name`, `handle` (unique), `role text default 'Community Member'`, `company`, `avatar_url`, `bio`, `tags text[]`, `linkedin_url`, `twitter_url`, `is_online`, `is_verified`, `is_admin`, `onboarded`, `email`, `membership jsonb`, `preferences jsonb`, `created_at`, `updated_at`. Attach `set_updated_at` trigger. RLS: select all authenticated, insert/update own, admin update any (via `is_admin()`), admin delete. Per specs/supabase-schema-migrations.md
- [x] **P2.6** Migration: `posts` table — per specs/supabase-migration-database.md `posts` section. `id uuid PK`, `author_id uuid FK→profiles on delete cascade`, `content text not null`, `media_url`, `media_type text check ('image','video')`, `likes_count int default 0`, `comments_count int default 0`, `is_sponsored`, `created_at`, `updated_at`. Attach `set_updated_at` trigger. RLS: select all, insert/update/delete own or admin (via `is_admin()`). Per specs/supabase-schema-migrations.md
- [x] **P2.7** Migration: `post_likes` table — per specs/supabase-migration-database.md. Junction table: `post_id uuid FK→posts on delete cascade`, `user_id uuid FK→profiles on delete cascade`, `created_at`. PK on `(post_id, user_id)`. RLS: select all, insert/delete own `user_id`. Per specs/supabase-schema-migrations.md
- [x] **P2.8** Migration: `post_comments` table — per specs/supabase-migration-database.md. `id uuid PK`, `post_id FK→posts on delete cascade`, `author_id FK→profiles on delete cascade`, `content text not null`, `is_edited boolean default false`, `created_at`, `updated_at`. Attach `set_updated_at` trigger. RLS: select all, insert own, update own (content + is_edited only), delete own or admin (via `is_admin()`). Per specs/supabase-schema-migrations.md
- [x] **P2.9** Migration: `resources` table — per specs/supabase-migration-database.md. `id uuid PK`, `title`, `description`, `type text check ('Video','Report','Insight')`, `category`, `author text` (denormalized name), `duration`, `stats`, `image_url`, `icon`, `created_at`. RLS: select all, insert/update/delete admin only (via `is_admin()`). Per specs/supabase-schema-migrations.md
- [x] **P2.10** Migration: `saved_resources` table — per specs/supabase-migration-database.md. Junction table: `user_id uuid FK→profiles on delete cascade`, `resource_id uuid FK→resources on delete cascade`, `created_at`. PK on `(user_id, resource_id)`. RLS: select/insert/delete own `user_id`. Per specs/supabase-schema-migrations.md
- [x] **P2.11** Migration: `messages` table — per specs/supabase-migration-database.md. `id uuid PK`, `sender_id FK→profiles on delete cascade`, `receiver_id FK→profiles on delete cascade`, `content text not null`, `is_read boolean default false`, `created_at`. RLS: select where sender or receiver, insert where sender, update `is_read` where receiver only. Per specs/supabase-schema-migrations.md
- [x] **P2.12** Migration: `connections` table — per specs/supabase-migration-database.md. `id uuid PK`, `user_id FK→profiles on delete cascade`, `other_user_id FK→profiles on delete cascade`, `status text check ('pending','accepted','rejected')`, `created_at`. Unique on `(user_id, other_user_id)`. RLS: select where participant, insert own `user_id`, update status where `other_user_id` only. Per specs/supabase-schema-migrations.md
- [x] **P2.13a** Migration verification — run `supabase db reset` to confirm all 9 migrations (1 utility + 8 tables) apply cleanly in order. Fix any FK ordering or syntax issues
- [x] **P2.13b** Regenerate `database.types.ts` — `npx supabase gen types typescript --local > src/lib/database.types.ts`. Verify types are non-empty and match all 8 tables
- [x] **P2.13c** Create `supabase/seed.sql` — must insert `auth.users` rows first (hardcoded UUIDs, runs as superuser), then profiles, then all dependent tables. Include 4+ profiles, 3+ posts with likes/comments, 3+ resources with saves, sample messages between users, sample connections. Run `supabase db reset` to verify seed applies after migrations. Per specs/supabase-schema-migrations.md
- [x] **P2.13d** Auth provider smoke test — with local Supabase running, verify in Studio (:54323) that Google, LinkedIn OIDC, email/password sign-up, and magic link are all configured and functional. Email testing via Inbucket (:54324)

### 2C: Storage Buckets

- [x] **P2.16** Migration: Create storage buckets — `avatars` (public, image/*, 1MB), `post-media` (public, image/video, 10MB), `voice-notes` (private, audio/*, 5MB), `resources` (private) per specs/supabase-storage.md
- [x] **P2.17** Migration: Storage RLS policies — users upload to own folder, public read on avatars/post-media per specs/supabase-storage.md

### 2D: Auth

- [x] **P2.18** Replace `UserContext.tsx` with Supabase auth — `onAuthStateChange`, `signInWithOAuth({ provider: 'google' })`, session management per specs/supabase-auth.md. Table is `profiles` (not `users`)
- [x] **P2.19** Add LinkedIn OIDC sign-in — configure provider in Supabase dashboard, use `provider: 'linkedin_oidc'`, extract profile claims for onboarding auto-fill per specs/supabase-linkedin-oidc.md. Note: LinkedIn provides name/email/avatar but NOT job title/company — those come from onboarding
- [x] **P2.20** Add magic link (passwordless email) sign-in — `signInWithOtp({ email })` with redirect URL per specs/supabase-auth.md
- [x] **P2.21** Create auth callback handler — exchange code for session on OAuth/magic link redirect per specs/supabase-auth.md (PKCE flow)
- [x] **P2.22** Update login UI in App.tsx — add LinkedIn and magic link options alongside Google

### 2E: Service Layer Migration (page by page)

> Replace all Firebase reads/writes with Supabase queries. Each task covers one page.

- [x] **P2.23** Migrate OnboardingPage — write user profile to Supabase `profiles` table, auto-fill from LinkedIn `user_metadata` if available (name, avatar_url, email only — job/company from onboarding form)
- [x] **P2.24** Migrate FeedPage — replace Firestore `posts` reads/writes with Supabase `.from('posts')`, join `profiles` for author data (eliminates N+1), real-time via `channel().on('postgres_changes')`
- [x] **P2.25** Migrate FeedPage comments — replace subcollection pattern with Supabase `post_comments` table queries, join `profiles` for author name/avatar
- [x] **P2.26** Migrate FeedPage likes — replace Firestore `posts/{id}/likes` subcollection with Supabase `post_likes` table. Toggle: insert/delete row, update `posts.likes_count` via RPC or app-level increment
- [x] **P2.27** Migrate FeedPage media uploads — replace Firebase Storage with Supabase Storage `post-media` bucket per specs/supabase-storage.md
- [x] **P2.28** Migrate ConnectionsPage — persist swipe actions to `connections` table (fixes unpersisted matches bug), query accepted connections for "Active Matches". Column names: `user_id`/`other_user_id`
- [ ] **P2.29** Migrate ChatPage — replace Firestore `messages` with Supabase `messages` table, proper query filtering (fixes inefficient all-messages fetch), real-time subscriptions. Use `is_read` for read receipts
- [ ] **P2.30** Migrate ChatPage voice notes — replace Firebase Storage with Supabase Storage `voice-notes` bucket
- [ ] **P2.31** Migrate ResourcesPage + ResourceDetailPage — replace Firestore reads with Supabase `resources` queries, replace `saved_resources` subcollection with Supabase `saved_resources` junction table
- [ ] **P2.32** Migrate ProfilePage + PersonalInfoPage — Supabase `profiles` reads/writes, avatar upload to Supabase Storage (fixes base64 bloat bug)
- [ ] **P2.33** Migrate SettingsPage — saved resources from `saved_resources` table, preferences from `profiles.preferences` jsonb column
- [ ] **P2.34** Migrate MembershipPage — membership data from `profiles.membership` jsonb column
- [ ] **P2.35** Migrate AdminDashboardPage — Supabase queries for profiles/posts/resources, guard on `profiles.is_admin`
- [ ] **P2.36** Update seed service — replace Firestore seeding with Supabase `seed.sql` per specs/supabase-schema-migrations.md

### 2F: Cleanup

- [ ] **P2.37** Remove Firebase — delete `firebase.ts`, `firebase-applet-config.json`, `firebase.json`, `firestore.rules`, uninstall `firebase` from `package.json`
- [ ] **P2.38** Remove `src/constants.ts` mock data (or reduce to type examples only)
- [ ] **P2.39** Update `vercel.json` with any needed headers/env. Deploy and verify with `vercel-plugin:deploy`

---

## Phase 3: Event Schedule Feature

> New feature per specs/decarb-connect-v2.md. Event tables created here (not in Phase 2B — they have no Firestore equivalent to migrate).

### 3A: Event Schema (migrations)

- [ ] **P3.0a** Migration: `events` table — per specs/decarb-connect-v2.md (id uuid PK, title, description, speaker text, room text, track text, starts_at timestamptz, ends_at timestamptz, created_at). RLS: select all, insert/update/delete admin only (check `profiles.is_admin` via join). Per specs/supabase-schema-migrations.md
- [ ] **P3.0b** Migration: `event_bookmarks` table — (user_id FK→profiles on delete cascade, event_id FK→events on delete cascade, created_at). PK on (user_id, event_id). RLS: select/insert/delete own. Per specs/supabase-schema-migrations.md
- [ ] **P3.0c** Migration: `event_checkins` table — (user_id FK→profiles on delete cascade, event_id FK→events on delete cascade, checked_in_at timestamptz default now()). PK on (user_id, event_id). RLS: insert/select own, admin select all. Per specs/supabase-schema-migrations.md
- [ ] **P3.0d** Migration: `questions` table — (id uuid PK, event_id FK→events on delete cascade, author_id FK→profiles, content text not null, upvotes int default 0, is_highlighted boolean default false, created_at). RLS: select all, insert own, update admin only (highlight). Per specs/supabase-schema-migrations.md
- [ ] **P3.0e** Regenerate `database.types.ts` after event migrations. Add event seed data to `seed.sql`

### 3B: Schedule Browsing

- [ ] **P3.1** Create `src/pages/SchedulePage.tsx` — day/time grid view of all events, filter by track/room/speaker/time slot. Real-time updates via Supabase subscription
- [ ] **P3.2** Create `src/pages/SessionDetailPage.tsx` — session description, speaker bio, room info, bookmark button, check-in button, Q&A section
- [ ] **P3.3** Add routes — `/schedule` and `/schedule/:sessionId` in App.tsx, add Schedule to sidebar/bottom nav

### Personal Agenda

- [ ] **P3.4** Create "My Agenda" view — filtered view of bookmarked sessions from `event_bookmarks` table, accessible from SchedulePage or as a tab
- [ ] **P3.5** Implement conflict detection — warn when bookmarking overlapping sessions (compare start/end times of bookmarked events)
- [ ] **P3.6** Visual bookmark indicators — show bookmark state on schedule grid items

### Live Session Features

- [ ] **P3.7** Implement session check-in — insert to `event_checkins` table, visual confirmation on SessionDetailPage
- [ ] **P3.8** Implement live Q&A — submit questions to `questions` table, real-time subscription for new questions, upvote mechanism
- [ ] **P3.9** Implement question highlighting — admin/speaker can pin/highlight questions, real-time update to all attendees

### Seed Data

- [ ] **P3.10** Add schedule seed data to `seed.sql` — sample sessions across multiple days/tracks/rooms for development (covered by P3.0e if done together)

---

## Phase 4: Admin Dashboard

> Per specs/decarb-connect-v2.md, specs/shadcn-ui.md. Anthropic Claude and MCP Server removed from scope per TECHNOLOGY_CHOICES.md — admin moderation is manual via dashboard UI.

### 4A: Admin UI Setup

- [ ] **P4.1** Initialize shadcn/ui — `npx shadcn@latest init` for Vite, reconcile CSS variable conflicts with existing theme (project uses `--color-background`, shadcn uses `--background`), reconcile `cn()` utility per specs/shadcn-ui.md. Use `vercel-plugin:shadcn` skill
- [ ] **P4.2** Install shadcn components needed — Table, Dialog, DropdownMenu, Tabs, Badge, Input, Select, Command per specs/shadcn-ui.md
- [ ] **P4.3** Install additional deps — `@tanstack/react-table`, `react-hook-form`, `@hookform/resolvers`, `zod` per specs/shadcn-ui.md

### 4B: Admin Dashboard Rebuild

- [ ] **P4.4** Rebuild AdminDashboardPage — User Management tab with data table (search, filter, edit roles, ban/suspend) using TanStack Table + shadcn per specs/shadcn-ui.md. Use `front-end-design` skill for UI quality
- [ ] **P4.5** Add Event Management tab — CRUD for sessions, speakers, rooms, tracks
- [ ] **P4.6** Add Content Moderation tab — manual moderation queue for reported posts/comments with approve/remove actions (no AI — manual review only)
- [ ] **P4.7** Add Analytics tab — user count, active connections, popular sessions, check-in rates from Supabase aggregation queries
- [ ] **P4.8** Add Onboarding Management tab — view onboarding completion rates, manually trigger re-onboard for specific users per specs/decarb-connect-v2.md

---

## Testing

> No test framework currently configured. Add minimal coverage for critical paths.

- [ ] **T1** Set up Vitest — install `vitest`, `@testing-library/react`, configure in `vite.config.ts`
- [ ] **T2** Auth flow tests — verify sign-in/sign-out, session persistence, role-based access
- [ ] **T3** Supabase query tests — verify CRUD operations against local Supabase (via `supabase start`)
- [ ] **T4** Schedule feature tests — bookmark conflict detection logic, Q&A upvote mechanics

---

## Low Priority / Future Release

> Out of scope for v2 but noted for tracking.

- [ ] Actual payment integration for membership tiers (currently mock)
- [ ] Push notification infrastructure (preference toggle exists but no backend)
- [ ] File attachment uploads in chat (currently metadata-only, bytes never uploaded)
- [ ] Post-event follow-up features (activity map shows this as a lifecycle stage)
- [ ] Gemini AI features (existing `GEMINI_API_KEY` retained but unused in v2 scope)
- [ ] AI content moderation via Claude (removed from v2 scope — revisit if manual moderation becomes bottleneck)
- [ ] MCP server for natural language admin (removed from v2 scope — revisit post-dashboard)
- [ ] Advanced analytics dashboard (engagement trends, time-series, export)
- [ ] Dedicated speaker profiles page (spec implies linked profiles from sessions — currently speaker bio is inline on SessionDetailPage)
- [ ] Refactor Sidebar/BottomNav to share nav item logic (currently fully duplicated)

---

## Notes

- **Current release (v2.4b–2.13d):** Tasks P2.4b through P2.13d. Prerequisite: Docker running for `supabase start`. Deliverable: full Postgres schema (1 utility + 8 tables) locally with RLS, generated types, seed data, and auth providers configured.
- **Authoritative schema source:** `specs/supabase-migration-database.md` — defines all 8 tables, column types, RLS policies, and auth providers. Overrides any column details in the implementation plan if there's a conflict.
- **Table naming:** `profiles` (not `users`) to avoid collision with `auth.users`. All FK references use `profiles(id)`.
- **Admin role design:** `profiles.is_admin boolean` for RLS checks + `profiles.role text` for human-readable display (e.g., 'Community Member', 'Sustainability Director'). NOT a Postgres enum — role is a freeform job title, `is_admin` is the authorization flag. RLS policies use `is_admin()` helper function (created in P2.4d utility migration).
- **Junction tables:** `post_likes(post_id, user_id)` and `saved_resources(user_id, resource_id)` use composite primary keys, no separate `id` column.
- **Migration ordering constraint:** Utility functions first (P2.4d), then `profiles` (all other tables FK to it). Then `posts` before `post_likes`/`post_comments`. Then `resources` before `saved_resources`. `messages` and `connections` are independent. Total: 9 migration files.
- **`updated_at` trigger:** Tables with `updated_at` columns (`profiles`, `posts`, `post_comments`) must include `create trigger set_updated_at before update on <table> for each row execute function set_updated_at()` in their migration file.
- **Seed data auth prerequisite:** `seed.sql` must insert into `auth.users` before `profiles` since `profiles.id` references `auth.users(id)`. Use hardcoded UUIDs for predictable test data. Runs as superuser so no RLS restrictions apply.
- **Event tables deferred to Phase 3:** `events`, `event_bookmarks`, `event_checkins`, `questions` have no Firestore equivalent — they're new features, not migration targets. Creating them in Phase 2B would add untestable schema.
- **Anthropic/MCP removed from scope:** Per TECHNOLOGY_CHOICES.md, Claude AI content moderation and MCP server are dropped. Phase 4 is admin dashboard only (shadcn/ui). Manual moderation replaces AI moderation.
- **Skill references:** Use `vercel-plugin:shadcn` for P4.1-P4.2. Use `vercel-plugin:env` for P2.4c. Use `vercel-plugin:deploy` for P2.39. Use `vercel-plugin:verification` after each phase.
- **Env vars needed:** `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (all in `.env.local`). Future: LinkedIn OAuth credentials (configured in Supabase dashboard).
- **`src/lib/` exists** — created by P2.2 with `supabase.ts` and `database.types.ts`.
- **`react-router-dom` vs `react-router`:** Current `package.json` uses `react-router-dom@7.13.1`. Per specs/react-router-v7.md, v7 exports from `react-router` but `react-router-dom` still works as a re-export. No change needed.
- **Path alias:** After P1.3 fix, `@/` → `./src/`. All imports like `@/components/UI` resolve to `src/components/UI`.
- **Firebase config note:** `firestore.rules` has a hardcoded admin email `d@planet.earth` — will be removed with Firebase cleanup in P2.37.
- **`src/types.ts` update needed:** After migration, `Post.author` (embedded User) becomes a join via `author_id`, `Comment` loses denormalized `authorName`/`authorAvatar`, `Message.sender` becomes `sender_id`/`receiver_id`. Type updates happen during service layer migration (Phase 2E), not during schema phase.
