-- P3.0a: events table
create table events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  speaker text,
  room text,
  track text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  created_at timestamptz default now()
);

alter table events enable row level security;

-- Anyone authenticated can view events
create policy "events_select" on events
  for select to authenticated
  using (true);

-- Only admins can manage events
create policy "events_insert" on events
  for insert to authenticated
  with check (is_admin());

create policy "events_update" on events
  for update to authenticated
  using (is_admin());

create policy "events_delete" on events
  for delete to authenticated
  using (is_admin());
