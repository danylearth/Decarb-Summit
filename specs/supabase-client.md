# Supabase Client SDK

## Overview

`@supabase/supabase-js` is an isomorphic JavaScript client for Supabase that provides access to Auth, Database (PostgREST), Realtime, Storage, and Edge Functions. It works in browsers, Node.js, Deno, Bun, React Native, and Cloudflare Workers. For our Vite + React app, it replaces Firebase as the backend client.

## Installation

```bash
npm install @supabase/supabase-js
```

## Configuration

### Environment Variables

For a Vite app, prefix with `VITE_`:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

- `VITE_SUPABASE_URL` — Your Supabase project URL (found in Project Settings > API)
- `VITE_SUPABASE_ANON_KEY` — The public anonymous key (safe to expose in client code; RLS protects data)

### Initialization

```typescript
// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types' // generated types

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
  },
  realtime: {
    params: { eventsPerSecond: 10 },
  },
})
```

### `createClient` Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `auth.autoRefreshToken` | boolean | `true` | Auto-refresh JWT before expiry |
| `auth.persistSession` | boolean | `true` | Persist session in localStorage |
| `auth.detectSessionInUrl` | boolean | `true` | Detect OAuth callback in URL hash |
| `auth.flowType` | string | `'pkce'` | Auth flow: `'pkce'` (recommended) or `'implicit'` |
| `db.schema` | string | `'public'` | Default database schema |
| `db.timeout` | number | `30000` | Query timeout in ms |
| `realtime.params.eventsPerSecond` | number | `10` | Rate limit for realtime events |
| `global.headers` | object | `{}` | Custom headers sent with all requests |
| `global.fetch` | function | native fetch | Custom fetch implementation |

### TypeScript Type Generation

Generate types from your Supabase schema for type-safe queries:

```bash
npx supabase gen types typescript --project-id your-project-id > src/lib/database.types.ts
```

## Key Patterns

### Authentication

#### OAuth Sign-In (Google)

```typescript
const { data, error } = await supabase.auth.signInWithOAuth({
  provider: 'google',
  options: {
    redirectTo: `${window.location.origin}/auth/callback`,
    scopes: 'email profile',
    queryParams: {
      access_type: 'offline',
      prompt: 'consent',
    },
  },
})
```

#### Email/Password Sign-In

```typescript
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'user@example.com',
  password: 'secure-password-123',
})

if (data.session) {
  console.log('Access token:', data.session.access_token)
  console.log('User:', data.user.email)
}
```

#### Listen to Auth State Changes

```typescript
const { data: { subscription } } = supabase.auth.onAuthStateChange(
  (event, session) => {
    // event: SIGNED_IN | SIGNED_OUT | TOKEN_REFRESHED | PASSWORD_RECOVERY
    if (event === 'SIGNED_IN') {
      console.log('User signed in:', session?.user.email)
    } else if (event === 'SIGNED_OUT') {
      console.log('User signed out')
    }
  }
)

// Cleanup when component unmounts
subscription.unsubscribe()
```

#### Get Current Session / User

```typescript
// Get session (from localStorage, no network call)
const { data: { session } } = await supabase.auth.getSession()

// Get user (validates JWT with server)
const { data: { user } } = await supabase.auth.getUser()
```

#### Sign Out

```typescript
await supabase.auth.signOut()

// Sign out from ALL devices
await supabase.auth.signOut({ scope: 'global' })
```

### Database Queries

#### Select

```typescript
// Select all columns
const { data, error } = await supabase
  .from('users')
  .select('*')

// Select specific columns
const { data, error } = await supabase
  .from('profiles')
  .select('id, username, avatar_url, created_at')

// Select with relationships (foreign key joins)
const { data, error } = await supabase
  .from('posts')
  .select(`
    id, title, content, created_at,
    author:users(id, username, avatar_url),
    comments(id, text, user:users(username))
  `)

// Single row
const { data, error } = await supabase
  .from('users')
  .select('*')
  .eq('id', userId)
  .single()
```

#### Insert

```typescript
// Insert single row
const { data, error } = await supabase
  .from('posts')
  .insert({ title: 'Hello', content: 'World', author_id: userId })
  .select()
  .single()

// Insert multiple rows
const { data, error } = await supabase
  .from('posts')
  .insert([
    { title: 'Post 1', author_id: userId },
    { title: 'Post 2', author_id: userId },
  ])
  .select()
```

#### Update

```typescript
const { data, error } = await supabase
  .from('posts')
  .update({ title: 'Updated Title' })
  .eq('id', postId)
  .select()
  .single()

// Bulk update with count
const { count } = await supabase
  .from('posts')
  .update({ status: 'archived' })
  .eq('author_id', userId)
  .lt('created_at', '2023-01-01')
  .select('id', { count: 'exact' })
```

#### Upsert

```typescript
const { data, error } = await supabase
  .from('user_settings')
  .upsert(
    { user_id: userId, theme: 'dark', notifications: true },
    { onConflict: 'user_id' }
  )
  .select()
  .single()
```

#### Delete

```typescript
const { error } = await supabase
  .from('posts')
  .delete()
  .eq('id', postId)
```

### Filtering & Ordering

```typescript
const { data, error, count } = await supabase
  .from('users')
  .select('*', { count: 'exact' })
  .eq('status', 'active')           // equality
  .neq('role', 'admin')             // not equal
  .gt('age', 18)                    // greater than
  .gte('score', 100)                // greater than or equal
  .lt('failed_attempts', 5)         // less than
  .lte('subscription_tier', 3)      // less than or equal
  .like('email', '%@gmail.com')     // pattern match
  .ilike('username', '%john%')      // case-insensitive pattern
  .in('country', ['US', 'CA', 'UK'])// in array
  .is('deleted_at', null)           // is null
  .not('status', 'eq', 'banned')    // negation
  .or('role.eq.admin,role.eq.moderator') // OR conditions
  .order('created_at', { ascending: false })
  .range(0, 9)                      // pagination (0-indexed, inclusive)
```

### Text Search

```typescript
const { data } = await supabase
  .from('posts')
  .select('*')
  .textSearch('title', 'javascript tutorial', { type: 'websearch' })
```

### Realtime Subscriptions

#### Database Changes (Postgres CDC)

```typescript
const channel = supabase
  .channel('db-changes')
  .on(
    'postgres_changes',
    {
      event: '*',          // 'INSERT' | 'UPDATE' | 'DELETE' | '*'
      schema: 'public',
      table: 'posts',
    },
    (payload) => {
      console.log('Event:', payload.eventType)
      console.log('New:', payload.new)
      console.log('Old:', payload.old)
    }
  )
  .subscribe((status) => {
    if (status === 'SUBSCRIBED') {
      console.log('Listening for changes')
    }
  })

// Filter to specific rows
const userChannel = supabase
  .channel('user-updates')
  .on(
    'postgres_changes',
    {
      event: 'UPDATE',
      schema: 'public',
      table: 'users',
      filter: 'id=eq.user-uuid',
    },
    (payload) => console.log('User updated:', payload.new)
  )
  .subscribe()

// Multiple listeners on one channel
const multiChannel = supabase
  .channel('multi-table')
  .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'posts' }, handleNewPost)
  .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'comments' }, handleNewComment)
  .subscribe()
```

#### Presence (Online Users)

```typescript
const presenceChannel = supabase.channel('online-users', {
  config: { presence: { key: userId } },
})

presenceChannel
  .on('presence', { event: 'sync' }, () => {
    const state = presenceChannel.presenceState()
    console.log('Online users:', state)
  })
  .on('presence', { event: 'join' }, ({ key, newPresences }) => {
    console.log('Joined:', key, newPresences)
  })
  .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
    console.log('Left:', key)
  })
  .subscribe(async (status) => {
    if (status === 'SUBSCRIBED') {
      await presenceChannel.track({
        online_at: new Date().toISOString(),
        user_info: { name: 'John', avatar: '/avatar.png' },
      })
    }
  })
```

#### Cleanup (Important!)

```typescript
// Remove a specific channel
supabase.removeChannel(channel)

// Remove all channels
supabase.removeAllChannels()

// In React useEffect:
useEffect(() => {
  const channel = supabase
    .channel('my-channel')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, handler)
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}, [])
```

## Row Level Security (RLS)

RLS is enforced at the Postgres level. The anon key used in the client respects these policies automatically. **You must enable RLS on every table** or data is publicly accessible.

### Basic RLS Pattern

```sql
-- Enable RLS (required per table)
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

-- Public read access
CREATE POLICY "Anyone can read posts"
  ON posts FOR SELECT
  TO anon, authenticated
  USING (true);

-- Authenticated users insert their own rows
CREATE POLICY "Users can create own posts"
  ON posts FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- Users update only their own rows
CREATE POLICY "Users can update own posts"
  ON posts FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- Users delete only their own rows
CREATE POLICY "Users can delete own posts"
  ON posts FOR DELETE
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);
```

### Key RLS Concepts

| Concept | Description |
|---------|-------------|
| `auth.uid()` | Returns the current user's UUID from the JWT |
| `TO anon` | Policy applies to unauthenticated (anon key) requests |
| `TO authenticated` | Policy applies to logged-in users |
| `USING (expr)` | Row-level filter for SELECT/UPDATE/DELETE (which rows can be seen) |
| `WITH CHECK (expr)` | Validation for INSERT/UPDATE (which rows can be written) |

### RLS + Realtime

For realtime subscriptions to respect RLS, enable **Realtime** on the table in the Supabase Dashboard (Database > Replication) and ensure RLS policies cover SELECT for the subscribing role.

## API Reference

### Client

| Method | Description |
|--------|-------------|
| `createClient(url, key, options?)` | Create a Supabase client instance |

### Auth

| Method | Description |
|--------|-------------|
| `auth.signInWithPassword({ email, password })` | Email/password sign-in |
| `auth.signInWithOAuth({ provider, options? })` | OAuth provider sign-in |
| `auth.signInWithOtp({ email \| phone })` | Magic link or OTP sign-in |
| `auth.signUp({ email, password, options? })` | Create a new user |
| `auth.signOut({ scope? })` | Sign out (`'local'` or `'global'`) |
| `auth.getSession()` | Get current session from storage |
| `auth.getUser()` | Get user by validating JWT with server |
| `auth.onAuthStateChange(callback)` | Listen for auth events; returns `{ subscription }` |
| `auth.updateUser({ email?, password?, data? })` | Update user attributes |
| `auth.refreshSession()` | Manually refresh the session token |

### Database

| Method | Description |
|--------|-------------|
| `from(table).select(columns, { count? })` | Read rows; supports joins via foreign keys |
| `from(table).insert(rows).select()` | Insert one or more rows |
| `from(table).update(values).eq(...).select()` | Update rows matching filters |
| `from(table).upsert(rows, { onConflict }).select()` | Insert or update on conflict |
| `from(table).delete().eq(...)` | Delete rows matching filters |

### Filters (chainable on queries)

| Method | Description |
|--------|-------------|
| `.eq(column, value)` | Equal |
| `.neq(column, value)` | Not equal |
| `.gt(column, value)` | Greater than |
| `.gte(column, value)` | Greater than or equal |
| `.lt(column, value)` | Less than |
| `.lte(column, value)` | Less than or equal |
| `.like(column, pattern)` | Pattern match (case-sensitive) |
| `.ilike(column, pattern)` | Pattern match (case-insensitive) |
| `.in(column, [values])` | Value in array |
| `.is(column, value)` | Is null / is true / is false |
| `.not(column, operator, value)` | Negate a filter |
| `.or(filters)` | OR conditions (PostgREST syntax string) |
| `.filter(column, operator, value)` | Raw filter (supports JSON columns) |
| `.textSearch(column, query, { type? })` | Full-text search |
| `.order(column, { ascending? })` | Sort results |
| `.range(from, to)` | Pagination (0-indexed, inclusive) |
| `.single()` | Expect exactly one row |
| `.maybeSingle()` | Expect zero or one row |

### Realtime

| Method | Description |
|--------|-------------|
| `channel(name, options?)` | Create a realtime channel |
| `.on('postgres_changes', filter, callback)` | Listen for DB changes |
| `.on('presence', { event }, callback)` | Listen for presence events |
| `.on('broadcast', { event }, callback)` | Listen for broadcast messages |
| `.subscribe(callback?)` | Activate the channel |
| `removeChannel(channel)` | Unsubscribe and remove a channel |
| `removeAllChannels()` | Remove all active channels |
| `channel.track(state)` | Track presence state |
| `channel.untrack()` | Remove presence state |
| `channel.send({ type, event, payload })` | Broadcast a message |

## Gotchas

1. **RLS is off by default** — Tables without RLS enabled are fully accessible to anyone with the anon key. Always `ALTER TABLE x ENABLE ROW LEVEL SECURITY` on every table.

2. **`getSession()` vs `getUser()`** — `getSession()` reads from localStorage (no network call, could be stale). `getUser()` validates the JWT against the server. Use `getUser()` for security-critical checks.

3. **Realtime requires replication enabled** — Database changes won't fire unless you enable Realtime for the table in Dashboard > Database > Replication.

4. **Realtime + RLS** — Realtime subscriptions respect RLS only if the table has RLS enabled and the user has a valid session. Without RLS, all connected clients see all changes.

5. **Always clean up subscriptions** — Failing to call `removeChannel()` on unmount causes memory leaks and stale listeners. Use React `useEffect` cleanup.

6. **`.single()` throws on 0 or 2+ rows** — If you're not sure exactly one row exists, use `.maybeSingle()` instead.

7. **Anon key is public** — The `VITE_SUPABASE_ANON_KEY` is safe to expose in client-side code because RLS policies enforce access control. Never expose the `service_role` key in client code.

8. **Insert doesn't return data by default** — You must chain `.select()` after `.insert()` / `.update()` / `.upsert()` to get the inserted/updated rows back.

9. **`UPDATE` RLS needs both `USING` and `WITH CHECK`** — `USING` controls which rows the user can see/target; `WITH CHECK` controls what values they can write. Omitting either can cause subtle permission issues.

10. **Vite env prefix** — Supabase docs use `NEXT_PUBLIC_` prefix (Next.js). For Vite, use `VITE_` prefix and access via `import.meta.env.VITE_*`.

## Rate Limits

- **Realtime:** Default 100 concurrent connections per project (configurable). `eventsPerSecond` defaults to 10 per channel.
- **Database (PostgREST):** No hard rate limit, but connection pool is shared. Default pool size depends on plan.
- **Auth:** Rate limits apply to sign-up/sign-in endpoints (varies by plan; free tier ~30 requests/hour for auth emails).
- **Storage:** 50MB file upload limit on free tier.

## References

- [supabase-js GitHub](https://github.com/supabase/supabase-js)
- [Supabase Docs — JavaScript Client](https://supabase.com/docs/reference/javascript/introduction)
- [Supabase Docs — Auth](https://supabase.com/docs/guides/auth)
- [Supabase Docs — Realtime](https://supabase.com/docs/guides/realtime)
- [Supabase Docs — Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)
- [Supabase Docs — Database](https://supabase.com/docs/guides/database)
- [Type Generation CLI](https://supabase.com/docs/guides/api/rest/generating-types)
