-- Connections table: tracks connection requests between users.
-- Implicit in ConnectionsPage matching logic (currently unpersisted in Firebase).

create table public.connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  other_user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null check (status in ('pending', 'accepted', 'rejected')),
  created_at timestamptz default now(),
  unique (user_id, other_user_id)
);

-- RLS
alter table public.connections enable row level security;

-- SELECT: users can view connections where they are a participant
create policy "Users can view own connections"
  on public.connections for select
  to authenticated
  using ( (select auth.uid()) in (user_id, other_user_id) );

-- INSERT: users can only create connections as the requester
create policy "Users can insert connections as requester"
  on public.connections for insert
  to authenticated
  with check ( (select auth.uid()) = user_id );

-- UPDATE: only the other_user can update status (accept/reject)
create policy "Recipients can update connection status"
  on public.connections for update
  to authenticated
  using ( (select auth.uid()) = other_user_id )
  with check ( (select auth.uid()) = other_user_id );
