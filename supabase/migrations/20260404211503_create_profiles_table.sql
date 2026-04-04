-- Profiles table: mirrors Firestore `users` collection.
-- References auth.users so each profile is tied to a Supabase Auth user.

create table public.profiles (
  id uuid not null references auth.users on delete cascade,
  name text not null,
  handle text not null unique,
  role text not null default 'Community Member',
  company text default '',
  avatar_url text,
  bio text default '',
  tags text[] default '{}',
  linkedin_url text,
  twitter_url text,
  is_online boolean default false,
  is_verified boolean default false,
  is_admin boolean default false,
  onboarded boolean default false,
  email text,
  membership jsonb default '{"plan":"Starter","price":"$0/mo","status":"Active","nextBilling":"N/A"}',
  preferences jsonb default '{"pushNotifications":true,"publicProfile":false}',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  primary key (id)
);

-- Helper function: returns true if the current authenticated user is an admin.
-- Defined here (not in utility_functions) because it queries the profiles table.
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and is_admin = true
  );
$$;

-- Auto-update updated_at on every UPDATE
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row
  execute function public.set_updated_at();

-- RLS
alter table public.profiles enable row level security;

-- SELECT: any authenticated user can read all profiles
create policy "Authenticated users can view all profiles"
  on public.profiles for select
  to authenticated
  using ( true );

-- INSERT: users can only insert their own profile
create policy "Users can insert own profile"
  on public.profiles for insert
  to authenticated
  with check ( (select auth.uid()) = id );

-- UPDATE: users can update their own profile
create policy "Users can update own profile"
  on public.profiles for update
  to authenticated
  using ( (select auth.uid()) = id )
  with check ( (select auth.uid()) = id );

-- UPDATE: admins can update any profile
create policy "Admins can update any profile"
  on public.profiles for update
  to authenticated
  using ( public.is_admin() )
  with check ( public.is_admin() );

-- DELETE: admins only
create policy "Admins can delete profiles"
  on public.profiles for delete
  to authenticated
  using ( public.is_admin() );
