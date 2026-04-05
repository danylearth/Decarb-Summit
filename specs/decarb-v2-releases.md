# Decarb Connect v2 — Release Plan

> 4 releases taking the app from Firebase to a complete Supabase platform with event scheduling, admin dashboard, and Claude MCP integration.

## Summary

- **Release 1 — DB Schema Ready**: Local Supabase running, 8 tables migrated with RLS, seed data, generated types
- **Release 2 — Supabase Live**: Auth swap, storage buckets, service layer migration, Firebase fully removed
- **Release 3 — Events**: Event schedule, personal agenda, live Q&A, check-in
- **Release 4 — Admin Dashboard**: shadcn/ui admin dashboard with manual moderation (no AI/MCP)

**Primary audience**: Summit attendees (networking & matching) + organizers (event management)
**Core aha moment**: Finding the right people to connect with
**Retention hook**: New messages and connection matches

---

## Release 1: DB Schema Ready

> Prerequisite: Docker running for `supabase start`

**Goal**: Full Postgres schema running locally with RLS, generated types, seed data, and auth providers configured. No user-facing changes yet.

### Tasks

- [ ] **P2.4b** Start local Supabase
  - [ ] `supabase start` completes without errors
  - [ ] Studio accessible at `localhost:54323`
  - [ ] Auth providers visible in Studio (Google, LinkedIn OIDC, email/password, magic link)

- [ ] **P2.5** Migration: `profiles` table
  - [ ] Table exists with all columns per specs/supabase-migration-database.md
  - [ ] `id` references `auth.users(id)` with `on delete cascade`
  - [ ] `handle` has unique constraint
  - [ ] RLS enabled: authenticated select all, insert/update own, admin update/delete any
  - [ ] `(select auth.uid())` used in all policies

- [ ] **P2.6** Migration: `posts` table
  - [ ] `author_id` FK to `profiles(id)` with cascade delete
  - [ ] `media_type` check constraint: `('image','video')`
  - [ ] `likes_count` and `comments_count` default to 0
  - [ ] RLS: select all authenticated, insert/update/delete own or admin

- [ ] **P2.7** Migration: `post_likes` table
  - [ ] Composite PK on `(post_id, user_id)`, no separate `id` column
  - [ ] Both FKs cascade on delete
  - [ ] RLS: select all, insert/delete own `user_id` only

- [ ] **P2.8** Migration: `post_comments` table
  - [ ] `is_edited` defaults to `false`
  - [ ] FK to both `posts` and `profiles` with cascade
  - [ ] RLS: select all, insert/update/delete own or admin

- [ ] **P2.9** Migration: `resources` table
  - [ ] `type` check constraint: `('Video','Report','Insight')`
  - [ ] RLS: select all authenticated, insert/update/delete admin only

- [ ] **P2.10** Migration: `saved_resources` table
  - [ ] Composite PK on `(user_id, resource_id)`
  - [ ] RLS: select/insert/delete own `user_id` only

- [ ] **P2.11** Migration: `messages` table
  - [ ] `sender_id` and `receiver_id` FK to `profiles(id)`
  - [ ] `is_read` defaults to `false`
  - [ ] RLS: select where sender or receiver, insert where sender, update `is_read` where receiver

- [ ] **P2.12** Migration: `connections` table
  - [ ] `status` check constraint: `('pending','accepted','rejected')`
  - [ ] Unique constraint on `(user_id, other_user_id)`
  - [ ] RLS: select where participant, insert own `user_id`, update status where `other_user_id`

- [ ] **P2.13a** Migration verification
  - [ ] `supabase db reset` applies all 8 migrations cleanly in order
  - [ ] No FK ordering or syntax errors

- [ ] **P2.13b** Regenerate `database.types.ts`
  - [ ] `npx supabase gen types typescript --local > src/lib/database.types.ts`
  - [ ] Generated types are non-empty and contain all 8 tables
  - [ ] `npm run lint` passes with new types

- [ ] **P2.13c** Create `supabase/seed.sql`
  - [ ] Sample data for all 8 tables
  - [ ] `supabase db reset` applies seed after migrations without errors
  - [ ] At least 5 sample profiles, 10 posts, assorted likes/comments/messages/connections

- [ ] **P2.13d** Auth provider smoke test
  - [ ] Google provider configured in Studio
  - [ ] LinkedIn OIDC provider configured in Studio
  - [ ] Email/password sign-up visible
  - [ ] Magic link option visible
  - [ ] Inbucket accessible at `localhost:54324` for email testing

### Done When
All 8 migrations apply cleanly via `supabase db reset`, generated types match schema, seed data populates, and auth providers are configured in local Studio.

---

## Release 2: Supabase Live

> Prerequisite: Release 1 complete

**Goal**: Firebase fully removed. App runs entirely on Supabase — auth, database, storage. Deployed to Vercel.

### Tasks

- [ ] **P2.4c** Push env vars to Vercel
  - [ ] `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` set in Vercel
  - [ ] Verified via `vercel env pull`

- [ ] **P2.16** Storage buckets migration
  - [ ] `avatars` bucket: public, image/*, 1MB limit
  - [ ] `post-media` bucket: public, image+video, 10MB limit
  - [ ] `voice-notes` bucket: private, audio/*, 5MB limit
  - [ ] `resources` bucket: private

- [ ] **P2.17** Storage RLS policies
  - [ ] Users can upload to own folder in each bucket
  - [ ] Public read on `avatars` and `post-media`
  - [ ] Private read (own files only) on `voice-notes`

- [ ] **P2.18** Replace UserContext with Supabase auth
  - [ ] `onAuthStateChange` replaces Firebase `onAuthStateChanged`
  - [ ] `signInWithOAuth({ provider: 'google' })` replaces `signInWithPopup`
  - [ ] Session persistence works across page reloads
  - [ ] `useUser()` hook API unchanged for consuming components

- [ ] **P2.19** LinkedIn OIDC sign-in
  - [ ] `signInWithOAuth({ provider: 'linkedin_oidc' })` works
  - [ ] Name, email, avatar extracted from `user_metadata`
  - [ ] Job title/company NOT auto-filled (comes from onboarding)

- [ ] **P2.20** Magic link sign-in
  - [ ] `signInWithOtp({ email })` sends email
  - [ ] Redirect URL configured for callback

- [ ] **P2.21** Auth callback handler
  - [ ] PKCE code exchange on OAuth/magic link redirect
  - [ ] Session established after callback

- [ ] **P2.22** Update login UI
  - [ ] Google, LinkedIn, and magic link options visible on login screen
  - [ ] All three auth methods functional

- [ ] **P2.23–P2.35** Service layer migration (page by page)
  - [ ] OnboardingPage writes to Supabase `profiles`, auto-fills from LinkedIn metadata
  - [ ] FeedPage reads/writes posts via Supabase, real-time via `postgres_changes`
  - [ ] FeedPage comments use `post_comments` table with profile joins
  - [ ] FeedPage likes use `post_likes` table with count sync
  - [ ] FeedPage media uploads use `post-media` storage bucket
  - [ ] ConnectionsPage persists swipe actions to `connections` table
  - [ ] ChatPage uses `messages` table with real-time subscriptions
  - [ ] ChatPage voice notes use `voice-notes` storage bucket
  - [ ] ResourcesPage + ResourceDetailPage use Supabase queries
  - [ ] ProfilePage + PersonalInfoPage use `profiles` table, avatar to storage
  - [ ] SettingsPage reads saved resources and preferences from Supabase
  - [ ] MembershipPage reads `profiles.membership` jsonb
  - [ ] AdminDashboardPage queries Supabase, guards on `profiles.is_admin`

- [ ] **P2.36** Update seed service
  - [ ] Firestore seeding replaced with `seed.sql`

- [ ] **P2.37** Remove Firebase
  - [ ] `firebase.ts` deleted
  - [ ] `firebase-applet-config.json` deleted
  - [ ] `firebase` package removed from `package.json`
  - [ ] No Firebase imports remain in codebase

- [ ] **P2.38** Remove mock data
  - [ ] `src/constants.ts` removed or reduced to type examples

- [ ] **P2.39** Deploy to Vercel
  - [ ] `vercel.json` updated if needed
  - [ ] Production deploy succeeds
  - [ ] App functional with Supabase backend

### Done When
Zero Firebase dependencies. All pages read/write Supabase. Auth works with Google, LinkedIn, and magic link. Storage serves avatars and media. Deployed and working on Vercel.

---

## Release 3: Events

> Prerequisite: Release 2 complete

**Goal**: Summit attendees can browse the event schedule, bookmark sessions, check in, and participate in live Q&A.

### Tasks

- [ ] **P3.0a** Migration: `events` table
  - [ ] Columns: id, title, description, speaker, room, track, starts_at, ends_at, created_at
  - [ ] RLS: select all authenticated, insert/update/delete admin only

- [ ] **P3.0b** Migration: `event_bookmarks` table
  - [ ] Composite PK on `(user_id, event_id)`
  - [ ] RLS: select/insert/delete own

- [ ] **P3.0c** Migration: `event_checkins` table
  - [ ] Composite PK on `(user_id, event_id)`
  - [ ] RLS: insert/select own, admin select all

- [ ] **P3.0d** Migration: `questions` table
  - [ ] Columns: id, event_id, author_id, content, upvotes, is_highlighted, created_at
  - [ ] RLS: select all, insert own, update admin only (highlight)

- [ ] **P3.0e** Regenerate types + seed data
  - [ ] `database.types.ts` includes all event tables
  - [ ] `seed.sql` has sample sessions across multiple days/tracks/rooms

- [ ] **P3.1** SchedulePage
  - [ ] Day/time grid view of all events
  - [ ] Filter by track, room, speaker, time slot
  - [ ] Real-time updates via Supabase subscription

- [ ] **P3.2** SessionDetailPage
  - [ ] Session description, speaker bio, room info
  - [ ] Bookmark button, check-in button
  - [ ] Q&A section with live questions

- [ ] **P3.3** Routes + navigation
  - [ ] `/schedule` and `/schedule/:sessionId` routes added
  - [ ] Schedule appears in sidebar and bottom nav

- [ ] **P3.4** My Agenda view
  - [ ] Filtered view of bookmarked sessions
  - [ ] Accessible from SchedulePage as tab or toggle

- [ ] **P3.5** Conflict detection
  - [ ] Warning shown when bookmarking overlapping sessions
  - [ ] Compares start/end times of existing bookmarks

- [ ] **P3.6** Bookmark indicators
  - [ ] Visual bookmark state on schedule grid items
  - [ ] Consistent with detail page bookmark button state

- [ ] **P3.7** Session check-in
  - [ ] Insert to `event_checkins` on tap
  - [ ] Visual confirmation on SessionDetailPage
  - [ ] Cannot check in to future sessions (or can — decide)

- [ ] **P3.8** Live Q&A
  - [ ] Submit questions to `questions` table
  - [ ] Real-time subscription for new questions
  - [ ] Upvote mechanism (one per user)

- [ ] **P3.9** Question highlighting
  - [ ] Admin/speaker can pin/highlight questions
  - [ ] Highlighted questions appear at top for all attendees

### Done When
Attendees can browse the schedule, bookmark sessions with conflict warnings, check in, and submit/upvote live Q&A questions. Admins can manage events and highlight questions.

---

## Release 4: Admin Dashboard

> Prerequisite: Release 3 complete

**Goal**: Full admin dashboard rebuilt with shadcn/ui. Manual content moderation (no AI). All admin operations through the UI.

### Tasks

- [ ] **P4.1** Initialize shadcn/ui
  - [ ] `npx shadcn@latest init` for Vite
  - [ ] CSS variable conflicts resolved (project `--color-background` vs shadcn `--background`)
  - [ ] `cn()` utility reconciled with existing one in `UI.tsx`

- [ ] **P4.2** Install shadcn components
  - [ ] Table, Dialog, DropdownMenu, Tabs, Badge, Input, Select, Command installed
  - [ ] All render correctly with existing theme

- [ ] **P4.3** Install additional deps
  - [ ] `@tanstack/react-table`, `react-hook-form`, `@hookform/resolvers`, `zod` added

- [ ] **P4.4** User Management tab
  - [ ] Data table with search and filter
  - [ ] Edit roles, ban/suspend users
  - [ ] TanStack Table + shadcn components

- [ ] **P4.5** Event Management tab
  - [ ] CRUD for sessions, speakers, rooms, tracks
  - [ ] Inline editing or modal forms

- [ ] **P4.6** Content Moderation tab
  - [ ] Flagged posts/comments queue (manual review)
  - [ ] Approve/remove actions with confirmation
  - [ ] Report/flag mechanism for users to flag content

- [ ] **P4.7** Analytics tab
  - [ ] User count, active connections, popular sessions, check-in rates
  - [ ] Data from Supabase aggregation queries

- [ ] **P4.8** Onboarding Management tab
  - [ ] View onboarding completion rates
  - [ ] Manually trigger re-onboard for specific users

- [ ] **P4.9** Admin Edge Function
  - [ ] API for dashboard UI
  - [ ] Auth via service role key
  - [ ] Routes: user CRUD, event CRUD, moderation actions

- [ ] **P4.10** CORS handling
  - [ ] Edge Function handles CORS headers correctly

### Done When
Admin dashboard fully functional with shadcn/ui. Admins can manage users, events, and content through the dashboard UI. Manual moderation queue handles flagged content.

---

## Testing (Cross-Release)

> No test framework currently configured. Add minimal coverage for critical paths.

- [ ] **T1** Set up Vitest with `@testing-library/react`
- [ ] **T2** Auth flow tests (sign-in/sign-out, session persistence, role access)
- [ ] **T3** Supabase query tests against local instance
- [ ] **T4** Schedule feature tests (conflict detection, Q&A upvotes)
- [ ] **T5** Admin dashboard tests (CRUD operations, role guards)

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Attendee connections made per summit | Track growth release-over-release |
| Messages sent per attendee | >5 during summit |
| Schedule bookmark rate | >50% of attendees bookmark at least 1 session |
| Q&A participation | >30% of session attendees submit or upvote a question |
| Admin response time (moderation) | <15 min for flagged content |
| Moderation response time | Flagged content reviewed within 15 min |
