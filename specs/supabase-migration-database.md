# Supabase Database Migration — Schema & Local Setup

> Migrate the existing Firebase/Firestore data model to a local Supabase Postgres database, mirroring the current schema 1:1 with proper relational structure and RLS.

## Problem / Solution

**Problem:** The app runs on Firebase Firestore with denormalized document collections. The migration to Supabase requires a Postgres schema that mirrors every Firestore collection and subcollection currently in use, plus a local development environment via the Supabase CLI and Docker.

**Solution:** Stand up a local Supabase instance, create SQL migrations for all tables, enable RLS policies, and configure all four auth providers (Google OAuth, LinkedIn OIDC, email/password, magic link).

## Firestore Collections → Postgres Tables

### Source collections (from codebase grep)

| Firestore Collection | Subcollections | Used By |
|---|---|---|
| `users` | `saved_resources` | UserContext, ConnectionsPage, ProfilePage, AdminDashboardPage, ChatPage, SettingsPage |
| `posts` | `likes`, `comments` | FeedPage, AdminDashboardPage, seedService |
| `resources` | — | ResourcesPage, ResourceDetailPage, AdminDashboardPage, seedService |
| `messages` | — | ConnectionsPage, ChatPage |

### Target Postgres schema

#### `profiles` (mirrors Firestore `users`)
- [x] `id` uuid PK (references `auth.users.id`)
- [x] `name` text not null
- [x] `handle` text not null unique
- [x] `role` text not null default 'Community Member'
- [x] `company` text default ''
- [x] `avatar_url` text
- [x] `bio` text default ''
- [x] `tags` text[] default '{}'
- [x] `linkedin_url` text
- [x] `twitter_url` text
- [x] `is_online` boolean default false
- [x] `is_verified` boolean default false
- [x] `is_admin` boolean default false
- [x] `onboarded` boolean default false
- [x] `email` text
- [x] `membership` jsonb default '{"plan":"Starter","price":"$0/mo","status":"Active","nextBilling":"N/A"}'
- [x] `preferences` jsonb default '{"pushNotifications":true,"publicProfile":false}'
- [x] `created_at` timestamptz default now()
- [x] `updated_at` timestamptz default now()

#### `posts`
- [x] `id` uuid PK default gen_random_uuid()
- [x] `author_id` uuid references profiles(id) on delete cascade
- [x] `content` text not null
- [x] `media_url` text
- [x] `media_type` text check (media_type in ('image', 'video'))
- [x] `likes_count` integer default 0
- [x] `comments_count` integer default 0
- [x] `is_sponsored` boolean default false
- [x] `created_at` timestamptz default now()
- [x] `updated_at` timestamptz default now()

#### `post_likes` (mirrors Firestore `posts/{id}/likes`)
- [x] `post_id` uuid references posts(id) on delete cascade
- [x] `user_id` uuid references profiles(id) on delete cascade
- [x] `created_at` timestamptz default now()
- [x] PK (post_id, user_id)

#### `post_comments` (mirrors Firestore `posts/{id}/comments`)
- [x] `id` uuid PK default gen_random_uuid()
- [x] `post_id` uuid references posts(id) on delete cascade
- [x] `author_id` uuid references profiles(id) on delete cascade
- [x] `content` text not null
- [x] `is_edited` boolean default false
- [x] `created_at` timestamptz default now()
- [x] `updated_at` timestamptz default now()

#### `resources`
- [x] `id` uuid PK default gen_random_uuid()
- [x] `title` text not null
- [x] `description` text not null
- [x] `type` text not null check (type in ('Video', 'Report', 'Insight'))
- [x] `category` text not null
- [x] `author` text not null
- [x] `duration` text
- [x] `stats` text
- [x] `image_url` text
- [x] `icon` text
- [x] `created_at` timestamptz default now()

#### `saved_resources` (mirrors Firestore `users/{id}/saved_resources`)
- [x] `user_id` uuid references profiles(id) on delete cascade
- [x] `resource_id` uuid references resources(id) on delete cascade
- [x] `created_at` timestamptz default now()
- [x] PK (user_id, resource_id)

#### `messages`
- [x] `id` uuid PK default gen_random_uuid()
- [x] `sender_id` uuid references profiles(id) on delete cascade
- [x] `receiver_id` uuid references profiles(id) on delete cascade
- [x] `content` text not null
- [x] `is_read` boolean default false
- [x] `created_at` timestamptz default now()

#### `connections` (implicit in ConnectionsPage matching logic)
- [x] `id` uuid PK default gen_random_uuid()
- [x] `user_id` uuid references profiles(id) on delete cascade
- [x] `other_user_id` uuid references profiles(id) on delete cascade
- [x] `status` text check (status in ('pending', 'accepted', 'rejected'))
- [x] `created_at` timestamptz default now()
- [x] unique(user_id, other_user_id)

## RLS Policies (per table)

### profiles
- SELECT: anyone authenticated can read all profiles
- INSERT: users can insert their own row (id = auth.uid())
- UPDATE: users can update their own row; admins can update any row
- DELETE: admins only

### posts
- SELECT: anyone authenticated
- INSERT: own author_id = auth.uid()
- UPDATE: own author_id or admin
- DELETE: own author_id or admin

### post_likes
- SELECT: anyone authenticated
- INSERT: own user_id = auth.uid()
- DELETE: own user_id = auth.uid()

### post_comments
- SELECT: anyone authenticated
- INSERT: own author_id = auth.uid()
- UPDATE: own author_id (content, is_edited only)
- DELETE: own author_id or admin

### resources
- SELECT: anyone authenticated
- INSERT/UPDATE/DELETE: admins only

### saved_resources
- SELECT/INSERT/DELETE: own user_id = auth.uid()

### messages
- SELECT: sender_id or receiver_id = auth.uid()
- INSERT: sender_id = auth.uid()
- UPDATE: receiver_id = auth.uid() (is_read only)

### connections
- SELECT: user_id or other_user_id = auth.uid()
- INSERT: user_id = auth.uid()
- UPDATE: other_user_id = auth.uid() (status only, for accepting/rejecting)

## Auth Providers

All four configured in `supabase/config.toml` for local dev:

1. **Email/password** — enabled by default
2. **Magic link** — passwordless email, enabled by default
3. **Google OAuth** — requires `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET`
4. **LinkedIn OIDC** — requires `LINKEDIN_CLIENT_ID` + `LINKEDIN_CLIENT_SECRET`

## Setup Steps

1. `supabase start` — start local Supabase (requires Docker)
2. Create migration files in `supabase/migrations/`
3. `supabase db reset` — apply migrations
4. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env.local` (from `supabase status` output)
5. `supabase gen types typescript --local > src/lib/database.types.ts` — generate types from live schema

## Success Criteria

- [ ] Local Supabase running via Docker with `supabase start`
- [ ] All 8 tables created with proper foreign keys and constraints
- [ ] RLS enabled on all tables with policies matching the spec above
- [ ] `database.types.ts` generated from live local schema (replaces hand-written scaffold)
- [ ] `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` set in `.env.local`
- [ ] Seed data script works against local Supabase
- [ ] All four auth providers configured in config.toml
