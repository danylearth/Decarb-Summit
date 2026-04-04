# Implementation Plan

<!-- Release: v2 — Supabase Platform Overhaul -->
<!-- Audience: Summit attendees (networking, scheduling, Q&A) + Admins (management via dashboard & Claude MCP) -->
<!-- Phases: Bug Fixes → Supabase Migration → Event Schedule → Admin Dashboard + MCP -->

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
- [ ] **P1.14** Audit and fix empty/loading/error states across pages — several pages have no error handling for failed Firestore reads

---

## Phase 2: Supabase Migration (Fresh Start)

> Complete Firebase → Supabase replacement. No data migration — clean slate. Per specs/decarb-connect-v2.md.

### 2A: Foundation

- [ ] **P2.1** Initialize Supabase project — `npx supabase init`, configure `config.toml` per specs/supabase-schema-migrations.md
- [ ] **P2.2** Create `src/lib/supabase.ts` — Supabase client initialization with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` per specs/supabase-client.md. Use PKCE flow, auto-refresh tokens
- [ ] **P2.3** Generate database types — `npx supabase gen types typescript` → `src/lib/database.types.ts` per specs/supabase-client.md
- [ ] **P2.4** Add env vars to `.env.local` — `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`. Add to Vercel via `vercel env` (use `vercel-plugin:env` skill)

### 2B: Database Schema (migrations)

> All tables per specs/decarb-connect-v2.md schema. Each migration per specs/supabase-schema-migrations.md patterns.

- [ ] **P2.5** Migration: `users` table — profiles with `role` enum (`user`, `admin`, `super_admin`), FK to `auth.users`, RLS policies (users read all, update own)
- [ ] **P2.6** Migration: `posts` table — community feed posts with author FK, RLS (read all, insert/update/delete own)
- [ ] **P2.7** Migration: `comments` table — on posts, author FK, RLS (read all, insert/update/delete own)
- [ ] **P2.8** Migration: `connections` table — user-to-user with status enum (`pending`, `accepted`, `rejected`), RLS (participants only)
- [ ] **P2.9** Migration: `messages` table — DMs between connected users, RLS (sender/receiver only)
- [ ] **P2.10** Migration: `events` table — schedule sessions (title, description, speaker, room, start/end time, track), RLS (read all, admin insert/update/delete)
- [ ] **P2.11** Migration: `event_bookmarks` table — user + event FK, unique constraint, RLS (own bookmarks)
- [ ] **P2.12** Migration: `event_checkins` table — user + event FK + timestamp, RLS (own check-ins, admin read all)
- [ ] **P2.13** Migration: `questions` table — live Q&A per session (author, content, upvotes, highlighted flag), RLS (read all in session, insert own, admin highlight)
- [ ] **P2.14** Migration: `resources` table — summit resources/documents, RLS (read all, admin CRUD)
- [ ] **P2.15** Regenerate `database.types.ts` after all migrations

### 2C: Storage Buckets

- [ ] **P2.16** Migration: Create storage buckets — `avatars` (public, image/*, 1MB), `post-media` (public, image/video, 10MB), `voice-notes` (private, audio/*, 5MB), `resources` (private) per specs/supabase-storage.md
- [ ] **P2.17** Migration: Storage RLS policies — users upload to own folder, public read on avatars/post-media per specs/supabase-storage.md

### 2D: Auth

- [ ] **P2.18** Replace `UserContext.tsx` with Supabase auth — `onAuthStateChange`, `signInWithOAuth({ provider: 'google' })`, session management per specs/supabase-auth.md
- [ ] **P2.19** Add LinkedIn OIDC sign-in — configure provider in Supabase dashboard, use `provider: 'linkedin_oidc'`, extract profile claims for onboarding auto-fill per specs/supabase-linkedin-oidc.md
- [ ] **P2.20** Add magic link (passwordless email) sign-in — `signInWithOtp({ email })` with redirect URL per specs/supabase-auth.md
- [ ] **P2.21** Create auth callback handler — exchange code for session on OAuth/magic link redirect per specs/supabase-auth.md (PKCE flow)
- [ ] **P2.22** Update login UI in App.tsx — add LinkedIn and magic link options alongside Google

### 2E: Service Layer Migration (page by page)

> Replace all Firebase reads/writes with Supabase queries. Each task covers one page.

- [ ] **P2.23** Migrate OnboardingPage — write user profile to Supabase `users` table, auto-fill from LinkedIn `user_metadata` if available
- [ ] **P2.24** Migrate FeedPage — replace Firestore `posts` reads/writes with Supabase `.from('posts')`, use join for author data (eliminates N+1), real-time via `channel().on('postgres_changes')`
- [ ] **P2.25** Migrate FeedPage comments — replace subcollection pattern with Supabase `comments` table queries
- [ ] **P2.26** Migrate FeedPage media uploads — replace Firebase Storage with Supabase Storage `post-media` bucket per specs/supabase-storage.md (fix uploadProgress tracking)
- [ ] **P2.27** Migrate ConnectionsPage — persist swipe actions to `connections` table (fixes unpersisted matches bug), query accepted connections for "Active Matches"
- [ ] **P2.28** Migrate ChatPage — replace Firestore `messages` with Supabase `messages` table, proper query filtering (fixes inefficient all-messages fetch), real-time subscriptions
- [ ] **P2.29** Migrate ChatPage voice notes — replace Firebase Storage with Supabase Storage `voice-notes` bucket
- [ ] **P2.30** Migrate ResourcesPage + ResourceDetailPage — replace Firestore reads with Supabase `resources` queries, replace saved_resources subcollection with Supabase pattern
- [ ] **P2.31** Migrate ProfilePage + PersonalInfoPage — Supabase `users` reads/writes, avatar upload to Supabase Storage (fixes base64 bloat bug)
- [ ] **P2.32** Migrate SettingsPage — saved resources from Supabase, preferences in `users` table
- [ ] **P2.33** Migrate MembershipPage — membership data in `users` table
- [ ] **P2.34** Migrate AdminDashboardPage — Supabase queries for users/posts/resources, add proper role guard
- [ ] **P2.35** Update seed service — replace Firestore seeding with Supabase `seed.sql` per specs/supabase-schema-migrations.md

### 2F: Cleanup

- [ ] **P2.36** Remove Firebase — delete `firebase.ts`, `firebase-applet-config.json`, `firebase.json`, `firestore.rules`, uninstall `firebase` from `package.json`
- [ ] **P2.37** Remove `src/constants.ts` mock data (or reduce to type examples only)
- [ ] **P2.38** Update `vercel.json` with any needed headers/env. Deploy and verify with `vercel-plugin:deploy`

---

## Phase 3: Event Schedule Feature

> New feature per specs/decarb-connect-v2.md. Tables already created in Phase 2B.

### Schedule Browsing

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

- [ ] **P3.10** Add schedule seed data to `seed.sql` — sample sessions across multiple days/tracks/rooms for development

---

## Phase 4: Admin Dashboard + Claude MCP

> Per specs/decarb-connect-v2.md, specs/shadcn-ui.md, specs/anthropic-claude-sdk.md, specs/mcp-typescript-sdk.md.

### 4A: Admin UI Setup

- [ ] **P4.1** Initialize shadcn/ui — `npx shadcn@latest init` for Vite, reconcile CSS variable conflicts with existing theme (project uses `--color-background`, shadcn uses `--background`), reconcile `cn()` utility per specs/shadcn-ui.md. Use `vercel-plugin:shadcn` skill
- [ ] **P4.2** Install shadcn components needed — Table, Dialog, DropdownMenu, Tabs, Badge, Input, Select, Command per specs/shadcn-ui.md
- [ ] **P4.3** Install additional deps — `@tanstack/react-table`, `react-hook-form`, `@hookform/resolvers`, `zod` per specs/shadcn-ui.md

### 4B: Admin Dashboard Rebuild

- [ ] **P4.4** Rebuild AdminDashboardPage — User Management tab with data table (search, filter, edit roles, ban/suspend) using TanStack Table + shadcn per specs/shadcn-ui.md
- [ ] **P4.5** Add Event Management tab — CRUD for sessions, speakers, rooms, tracks
- [ ] **P4.6** Add Content Moderation tab — flagged posts/comments queue with approve/remove actions
- [ ] **P4.7** Add Analytics tab — user count, active connections, popular sessions, check-in rates from Supabase aggregation queries
- [ ] **P4.8** Add Onboarding Management tab — view onboarding completion rates, manually trigger re-onboard for specific users per specs/decarb-connect-v2.md

### 4C: Supabase Edge Functions (Shared API)

- [ ] **P4.9** Create admin Edge Function — shared API endpoint consumed by both dashboard UI and MCP server. Auth via service role key. Routes: user CRUD, event CRUD, moderation actions per specs/supabase-edge-functions.md
- [ ] **P4.10** Add CORS handling to Edge Function per specs/supabase-edge-functions.md

### 4D: Content Moderation with Claude

- [ ] **P4.11** Create moderation Edge Function — uses `@anthropic-ai/sdk` with Claude Haiku for automated content moderation of posts/comments per specs/anthropic-claude-sdk.md. `ANTHROPIC_API_KEY` as Supabase secret
- [ ] **P4.12** Wire moderation into post/comment creation flow — call moderation function on new content, flag or auto-remove based on Claude response

### 4E: Claude MCP Server

- [ ] **P4.13** Create MCP server project — `mcp-server/` directory, `@modelcontextprotocol/sdk` v2, Zod v4, stdio transport per specs/mcp-typescript-sdk.md
- [ ] **P4.14** Register user tools — `list_users`, `get_user`, `update_user_role`, `ban_user`, `unban_user` per specs/mcp-typescript-sdk.md + specs/decarb-connect-v2.md
- [ ] **P4.15** Register event tools — `create_event`, `update_event`, `delete_event`, `list_events`
- [ ] **P4.16** Register moderation tools — `list_flagged_posts`, `remove_post`, `approve_post`
- [ ] **P4.17** Register analytics tools — `get_user_stats`, `get_event_stats`, `get_engagement_stats`
- [ ] **P4.18** Add MCP server connection docs — README for connecting Claude Desktop or Claude Code to the server

---

## Testing

> No test framework currently configured. Add minimal coverage for critical paths.

- [ ] **T1** Set up Vitest — install `vitest`, `@testing-library/react`, configure in `vite.config.ts`
- [ ] **T2** Auth flow tests — verify sign-in/sign-out, session persistence, role-based access
- [ ] **T3** Supabase query tests — verify CRUD operations against local Supabase (via `supabase start`)
- [ ] **T4** Schedule feature tests — bookmark conflict detection logic, Q&A upvote mechanics
- [ ] **T5** MCP server tests — tool registration, input validation, Supabase calls per specs/mcp-typescript-sdk.md

---

## Low Priority / Future Release

> Out of scope for v2 but noted for tracking.

- [ ] Actual payment integration for membership tiers (currently mock)
- [ ] Push notification infrastructure (preference toggle exists but no backend)
- [ ] File attachment uploads in chat (currently metadata-only, bytes never uploaded)
- [ ] Post-event follow-up features (activity map shows this as a lifecycle stage)
- [ ] Gemini AI features (existing `GEMINI_API_KEY` retained but unused in v2 scope)
- [ ] Advanced analytics dashboard (engagement trends, time-series, export)
- [ ] Dedicated speaker profiles page (spec implies linked profiles from sessions — currently speaker bio is inline on SessionDetailPage)
- [ ] Refactor Sidebar/BottomNav to share nav item logic (currently fully duplicated)

---

## Notes

- **Skill references:** Use `vercel-plugin:shadcn` for P4.1-P4.2. Use `vercel-plugin:env` for P2.4. Use `vercel-plugin:deploy` for P2.38. Use `vercel-plugin:verification` after each phase.
- **Env vars needed:** `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, LinkedIn OAuth credentials (configured in Supabase dashboard)
- **`react-router-dom` vs `react-router`:** Current `package.json` uses `react-router-dom@7.13.1`. Per specs/react-router-v7.md, v7 exports from `react-router` but `react-router-dom` still works as a re-export. No change needed.
- **Path alias:** After P1.3 fix, `@/` → `./src/`. All imports like `@/components/UI` resolve to `src/components/UI`.
- **No `src/lib/` directory exists yet** — P2.2 creates it. No `src/hooks/` either.
- **Firebase config note:** `firestore.rules` has a hardcoded admin email `d@planet.earth` — will be removed with Firebase cleanup in P2.36.
