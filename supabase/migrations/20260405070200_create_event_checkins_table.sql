-- P3.0c: event_checkins table
create table event_checkins (
  user_id uuid references profiles(id) on delete cascade,
  event_id uuid references events(id) on delete cascade,
  checked_in_at timestamptz default now(),
  primary key (user_id, event_id)
);

alter table event_checkins enable row level security;

-- Users can see and create their own check-ins
create policy "event_checkins_select_own" on event_checkins
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "event_checkins_insert_own" on event_checkins
  for insert to authenticated
  with check (user_id = (select auth.uid()));

-- Admins can see all check-ins
create policy "event_checkins_select_admin" on event_checkins
  for select to authenticated
  using (is_admin());
