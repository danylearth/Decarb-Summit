# Supabase Database Schema & Migrations

## Overview

Supabase uses PostgreSQL as its database. Schema changes are managed through SQL migration files tracked in version control, created and applied via the Supabase CLI. Row Level Security (RLS) policies are the primary authorization mechanism — they run at the database level so every access path (API, client SDK, direct connection) is protected.

## Installation

```bash
# Supabase CLI (if not already installed)
npm install -D supabase

# Initialize Supabase in the project (creates supabase/ directory)
npx supabase init
```

This creates:
```
supabase/
  config.toml        # Local dev configuration
  migrations/        # Timestamped SQL migration files
  seed.sql           # Optional seed data
```

## Configuration

### Environment Variables

No additional env vars needed for migrations — the CLI uses your project link:

```bash
# Link to your remote Supabase project
npx supabase link --project-ref <project-id>

# Project ID is found in Supabase Dashboard > Project Settings > General
```

### Local Development

```bash
# Start local Supabase (Postgres, Auth, Storage, etc.)
npx supabase start

# Stop local Supabase
npx supabase stop
```

## Key Patterns

### Creating a Migration

```bash
# Create a new timestamped migration file
npx supabase migration new create_profiles_table
# Creates: supabase/migrations/20260404120000_create_profiles_table.sql
```

Then write SQL in the generated file:

```sql
-- supabase/migrations/20260404120000_create_profiles_table.sql

create table public.profiles (
  id uuid not null references auth.users on delete cascade,
  display_name text not null,
  company text,
  role text,
  avatar_url text,
  created_at timestamptz default now(),

  primary key (id)
);

alter table public.profiles enable row level security;
```

### Applying Migrations

```bash
# Apply pending migrations to local database
npx supabase migration up

# Reset local database (drops and recreates, applies all migrations + seed.sql)
npx supabase db reset

# Push migrations to remote project
npx supabase db push
```

### Auto Schema Diff

Make changes via the Supabase Dashboard or SQL editor, then capture them:

```bash
# Generate a migration from the diff between local and remote
npx supabase db diff --use-migra -f my_change_name
# Creates a migration file with the SQL diff
```

### Migration Management

```bash
# List migration status (local vs remote)
npx supabase migration list

# Squash multiple migrations into one (reduces file count)
npx supabase migration squash

# Revert the most recent migration
npx supabase migration down

# Repair migration history (mark as applied/reverted without running)
npx supabase migration repair --status applied 20260404120000
npx supabase migration repair --status reverted 20260404120000
```

### Foreign Keys & Relationships

Always reference `auth.users` with `on delete cascade` for user-owned tables:

```sql
-- Profile table referencing auth.users
create table public.profiles (
  id uuid not null references auth.users on delete cascade,
  display_name text not null,
  primary key (id)
);

-- Posts table with foreign key to profiles
create table public.posts (
  id bigint primary key generated always as identity,
  author_id uuid not null references public.profiles (id) on delete cascade,
  content text not null,
  created_at timestamptz default now()
);

-- Connections table (many-to-many between profiles)
create table public.connections (
  id bigint primary key generated always as identity,
  requester_id uuid not null references public.profiles (id) on delete cascade,
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz default now(),

  unique (requester_id, recipient_id)
);
```

**Foreign key delete behaviors:**

| Option | Behavior |
|--------|----------|
| `on delete cascade` | Delete child rows when parent is deleted |
| `on delete restrict` | Prevent parent deletion if children exist |
| `on delete set null` | Set foreign key column to NULL on parent deletion |
| `on delete set default` | Set foreign key column to default value on parent deletion |
| `on delete no action` | Same as restrict (default) |

### Row Level Security (RLS) Policies

**Always enable RLS on every public table.** Without RLS, the table is accessible to anyone with the anon key.

#### SELECT — Users can read their own profile

```sql
create policy "Users can view own profile"
on public.profiles for select
to authenticated
using ( (select auth.uid()) = id );
```

#### SELECT — Public read access

```sql
create policy "Anyone can view posts"
on public.posts for select
to authenticated
using ( true );
```

#### INSERT — Users can only insert their own data

```sql
create policy "Users can create own posts"
on public.posts for insert
to authenticated
with check ( (select auth.uid()) = author_id );
```

#### UPDATE — Users can only update their own data

```sql
create policy "Users can update own profile"
on public.profiles for update
to authenticated
using ( (select auth.uid()) = id )
with check ( (select auth.uid()) = id );
```

#### DELETE — Users can only delete their own data

```sql
create policy "Users can delete own posts"
on public.posts for delete
to authenticated
using ( (select auth.uid()) = author_id );
```

#### RESTRICTIVE policy (AND logic)

By default policies are PERMISSIVE (OR'd together). Use RESTRICTIVE for policies that must ALL pass:

```sql
create policy "Owner only edit"
on public.posts
as restrictive
for update
to authenticated
using ( (select auth.uid()) = author_id )
with check ( (select auth.uid()) = author_id );
```

### Type Generation

After schema changes, regenerate TypeScript types:

```bash
# Generate types from remote database
npx supabase gen types typescript --linked > src/lib/database.types.ts

# Generate types from local database
npx supabase gen types typescript --local > src/lib/database.types.ts
```

### Seed Data

```sql
-- supabase/seed.sql (runs after migrations on `supabase db reset`)

insert into public.profiles (id, display_name, company, role)
values
  ('00000000-0000-0000-0000-000000000001', 'Demo User', 'Acme Corp', 'Engineer');
```

## API Reference — Migration CLI

| Command | Description |
|---------|-------------|
| `supabase migration new <name>` | Create a new timestamped migration file |
| `supabase migration up` | Apply pending migrations to local database |
| `supabase migration down` | Revert the most recent migration |
| `supabase migration list` | Show migration status (local vs remote) |
| `supabase migration squash` | Combine multiple migrations into one |
| `supabase migration repair` | Fix migration history without running SQL |
| `supabase db reset` | Drop and recreate local DB, apply all migrations + seed |
| `supabase db push` | Push local migrations to remote project |
| `supabase db diff` | Generate migration from schema differences |
| `supabase gen types typescript` | Generate TypeScript types from schema |

## API Reference — RLS Functions

| Function | Description | Example |
|----------|-------------|---------|
| `auth.uid()` | Returns the authenticated user's UUID | `(select auth.uid()) = user_id` |
| `auth.jwt()` | Returns the full JWT claims object | `(auth.jwt()->>'role') = 'admin'` |
| `auth.role()` | Returns the current role (anon/authenticated) | `auth.role() = 'authenticated'` |

## Gotchas

- **Always enable RLS.** A table without RLS is fully accessible via the public API. Every `create table` in a migration should be followed by `alter table ... enable row level security`.
- **Wrap `auth.uid()` in a subquery.** Use `(select auth.uid())` instead of bare `auth.uid()` in policies — the subquery form is significantly faster because PostgreSQL can cache the result across rows.
- **PERMISSIVE vs RESTRICTIVE.** Multiple PERMISSIVE policies are OR'd (any one passing grants access). RESTRICTIVE policies are AND'd (all must pass). Most apps need only PERMISSIVE policies.
- **`with check` vs `using`.** `using` filters which existing rows are visible/modifiable. `with check` validates new row values on INSERT/UPDATE. For UPDATE, use both to prevent users from reassigning ownership.
- **`on delete cascade` on auth.users references.** Always add this — otherwise deleting a user in Supabase Auth will fail if they have rows in your tables.
- **Migration ordering matters.** Files are applied in timestamp order. If table B references table A, table A's migration must have an earlier timestamp.
- **`db reset` is destructive.** It drops everything and re-applies from scratch. Safe for local dev, never run against production.
- **`db push` is for migrations only.** It applies migration files to remote. It does NOT sync seed data or storage.
- **Don't edit applied migrations.** Once a migration has been applied to remote, treat it as immutable. Create a new migration for fixes.
- **Service role bypasses RLS.** The `service_role` key ignores all RLS policies. Never expose it in client code.

## References

- [Database Migrations Guide](https://supabase.com/docs/guides/deployment/database-migrations)
- [Managing Environments](https://supabase.com/docs/guides/deployment/managing-environments)
- [Row Level Security Guide](https://supabase.com/docs/guides/auth/row-level-security)
- [RLS Simplified (Troubleshooting)](https://supabase.com/docs/guides/troubleshooting/rls-simplified-BJTcS8)
- [Cascade Deletes](https://supabase.com/docs/guides/database/postgres/cascade-deletes)
- [Managing User Data](https://supabase.com/docs/guides/auth/managing-user-data)
- [CLI Reference: migration](https://supabase.com/docs/reference/cli/supabase-migration)
- [CLI Reference: db](https://supabase.com/docs/reference/cli/supabase-db)
