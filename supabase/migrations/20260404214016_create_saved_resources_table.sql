-- Saved resources junction table: mirrors Firestore `users/{id}/saved_resources` subcollection.
-- Tracks which user saved which resource. Composite PK prevents duplicate saves.

create table public.saved_resources (
  user_id uuid not null references public.profiles(id) on delete cascade,
  resource_id uuid not null references public.resources(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (user_id, resource_id)
);

-- RLS
alter table public.saved_resources enable row level security;

-- SELECT: users can only see their own saved resources
create policy "Users can view own saved resources"
  on public.saved_resources for select
  to authenticated
  using ( (select auth.uid()) = user_id );

-- INSERT: users can only save resources as themselves
create policy "Users can insert own saved resources"
  on public.saved_resources for insert
  to authenticated
  with check ( (select auth.uid()) = user_id );

-- DELETE: users can only remove their own saved resources
create policy "Users can delete own saved resources"
  on public.saved_resources for delete
  to authenticated
  using ( (select auth.uid()) = user_id );
