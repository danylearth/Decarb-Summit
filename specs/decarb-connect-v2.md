# Decarb Connect v2 — Full Platform Overhaul

**One-liner:** Migrate to Supabase, add event scheduling with live Q&A, build an admin dashboard, and wire Claude MCP for AI-powered management — after fixing existing bugs.

---

## Problem

The current app runs on Firebase with no admin tooling, no event schedule, and known bugs. The stack limits what can be built (no relational data, no RLS, no server-side logic). Admins have zero visibility or control. There's no way to manage the summit schedule — the core reason attendees are there.

## Solution

Rebuild on Supabase for relational data + RLS + real-time subscriptions. Add a full event schedule with personal agendas and live Q&A. Build an admin dashboard with CRUD for users, events, and content moderation. Expose the same admin APIs as Claude MCP tools so the team can manage the platform from a local Claude environment.

---

## Phase 1: Bug Fixes (Current Firebase Stack)

Audit and fix existing issues before migration.

- [ ] Identify and document all bugs in the current app
- [ ] Fix routing/navigation issues
- [ ] Fix onboarding flow race conditions (localStorage + Firestore sync)
- [ ] Fix any broken UI states (empty states, loading states, error states)
- [ ] Fix responsive layout issues on mobile/desktop
- [ ] Verify chat functionality works end-to-end

---

## Phase 2: Supabase Migration (Fresh Start)

Replace Firebase entirely with Supabase. No data migration — clean slate.

### Auth
- [ ] Supabase Auth with multiple social providers (Google, LinkedIn, GitHub, etc.)
- [ ] Magic link email login (passwordless)
- [ ] LinkedIn OAuth — pull profile data (name, role, company, avatar, headline) via LinkedIn API on first login
- [ ] Auto-populate user profile from LinkedIn data during onboarding
- [ ] Session management via Supabase auth helpers

### Database Schema
- [ ] `users` — profiles with role field (`user` | `admin` | `super_admin`)
- [ ] `posts` — community feed posts with author FK
- [ ] `comments` — on posts, with author FK
- [ ] `connections` — user-to-user connection requests/status
- [ ] `messages` — direct messages between connected users
- [ ] `events` — schedule sessions (title, description, speaker, room, start/end time, track)
- [ ] `event_bookmarks` — user's personal agenda (user + event FK)
- [ ] `event_checkins` — attendance tracking (user + event FK + timestamp)
- [ ] `questions` — live Q&A per session (author, content, upvotes, highlighted flag)
- [ ] `resources` — summit resources/documents
- [ ] Row-Level Security policies on all tables
- [ ] Admin role bypasses for RLS where needed

### Service Layer
- [ ] Replace `src/firebase.ts` with Supabase client init
- [ ] Replace `src/context/UserContext.tsx` to use Supabase auth + real-time subscriptions
- [ ] Replace all Firestore reads/writes across pages with Supabase queries
- [ ] Replace Firebase Storage with Supabase Storage (avatars, file uploads)
- [ ] Remove `firebase-applet-config.json`, `firebase.json`, `firestore.rules`, `firebase-blueprint.json`
- [ ] Update environment variables (Supabase URL + anon key in `.env.local`)

---

## Phase 3: Event Schedule Feature

Full interactive schedule with personal agenda and live Q&A.

### Schedule Browsing
- [ ] Schedule page with day/time grid view
- [ ] Filter by track, room, speaker, time slot
- [ ] Session detail view — description, speaker bio, room info
- [ ] Speaker profiles linked from sessions
- [ ] Room/venue indicators

### Personal Agenda
- [ ] Bookmark/save sessions to personal schedule
- [ ] "My Agenda" view showing only bookmarked sessions
- [ ] Conflict detection (overlapping bookmarked sessions)
- [ ] Visual indicator on schedule for bookmarked sessions

### Live Session Features
- [ ] Session check-in (attendee marks attendance)
- [ ] Live Q&A — attendees submit questions during active sessions
- [ ] Question upvoting (attendees vote on best questions)
- [ ] Speaker/moderator can highlight/pin questions
- [ ] Real-time updates via Supabase subscriptions

---

## Phase 4: Admin Dashboard + Claude MCP

### Admin Dashboard (Web UI)
- [ ] Admin route (`/admin`) protected by role check
- [ ] **User Management** — table view of all users, search/filter, edit roles, ban/suspend
- [ ] **Event Management** — CRUD for schedule sessions, speakers, rooms, tracks
- [ ] **Content Moderation** — feed posts/comments queue, flag/remove/approve actions
- [ ] **Analytics** — user count, active connections, popular sessions, check-in rates
- [ ] **Onboarding Management** — view onboarding completion rates, manually trigger re-onboard

### Supabase API Layer (Shared)
- [ ] RESTful API endpoints or Supabase Edge Functions for all admin actions
- [ ] Same endpoints consumed by both the dashboard UI and Claude MCP tools
- [ ] Auth middleware — verify admin role on all admin endpoints

### Claude MCP Server
- [ ] MCP server exposing tools that call the admin API
- [ ] **User tools** — `list_users`, `get_user`, `update_user_role`, `ban_user`, `unban_user`
- [ ] **Event tools** — `create_event`, `update_event`, `delete_event`, `list_events`
- [ ] **Moderation tools** — `list_flagged_posts`, `remove_post`, `approve_post`
- [ ] **Analytics tools** — `get_user_stats`, `get_event_stats`, `get_engagement_stats`
- [ ] MCP server runs locally, authenticates to Supabase with a service role key
- [ ] Documentation for connecting Claude Desktop / Claude Code to the MCP server

---

## User Journey

1. **First Visit** — Landing page with social login options (Google, LinkedIn, magic link)
2. **LinkedIn Connect** — Profile auto-populated from LinkedIn data
3. **Onboarding** — Complete profile (role, company, bio, tags, expertise)
4. **Tutorial** — Guided walkthrough of connections, feed, schedule
5. **Daily Use** — Browse schedule, bookmark sessions, match with attendees, chat
6. **During Sessions** — Check in, submit Q&A questions, upvote others' questions
7. **Networking** — Swipe/match connections, chat, share resources

---

## Success Metrics

- Onboarding completion rate > 80%
- Sessions bookmarked per user > 3
- Q&A questions submitted per session > 5
- Daily active users during summit > 60% of registered
- Admin actions via MCP vs dashboard (track adoption of AI tooling)
