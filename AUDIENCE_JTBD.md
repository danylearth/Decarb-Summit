# Audience & Jobs to Be Done

## Target Audience
Industrial decarbonization summit attendees — sustainability directors, carbon strategy leads, climate-tech founders, and environmental engineers attending multi-day in-person events. Secondary audience: summit organizers/admins who manage the event, attendee onboarding, and content moderation.

## Primary Job to Be Done
When I'm **attending a decarbonization summit**, I want to **find and connect with the right people, build my session agenda, and engage during talks**, so I can **maximize the value of my time at the event and leave with actionable relationships**.

## Admin Job to Be Done
When I'm **organizing a decarbonization summit**, I want to **manage attendees, curate the schedule, and moderate community content from my local Claude environment**, so I can **run the event efficiently without building custom tooling or context-switching between dashboards**.

## Activity Map
Register → Connect LinkedIn → Complete profile → Browse schedule → Bookmark sessions → Match with attendees → Chat → Check in to sessions → Ask questions during talks → Upvote Q&A → Review resources → Follow up post-event

## Release Roadmap

### Release 1: DB Schema Ready
Activities: Local Supabase setup (Docker) → Schema migrations (8 tables) → RLS policies → Type generation → Auth providers → Seed data

### Release 2: Supabase Live
Activities: Storage buckets → Auth swap (Google + LinkedIn OIDC + magic link) → Service layer migration (page by page) → Firebase removal → Vercel deploy

### Release 3: Events
Activities: Event schema (4 tables) → Browse schedule → Bookmark sessions → Check in → Live Q&A → Question highlighting

### Release 4: Admin + MCP
Activities: shadcn/ui admin dashboard → Claude content moderation → MCP server for natural language admin

## Current Release Scope
Release: **Release 1 — DB Schema Ready** (P2.4b–P2.13d)
Activities: Local Supabase start → 8 table migrations → RLS → generated types → seed data → auth provider config

## SLC Criteria (Simple, Lovable, Complete)
- **Simple:** Mirror existing Firestore collections 1:1 into Postgres tables. Local-first via Supabase CLI + Docker before connecting to cloud. No new features — just the data layer swap.
- **Lovable:** Proper relational schema with foreign keys, constraints, and RLS replaces denormalized Firestore docs. Generated TypeScript types replace hand-written scaffolds.
- **Complete:** After this release, all 8 Postgres tables are in place locally with RLS policies, all auth providers configured, types generated, and seed data working. Event tables (4 more) deferred to Release 3 — they're new features, not migration targets.
