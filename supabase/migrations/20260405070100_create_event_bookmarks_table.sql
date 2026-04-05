-- P3.0b: event_bookmarks table
create table event_bookmarks (
  user_id uuid references profiles(id) on delete cascade,
  event_id uuid references events(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (user_id, event_id)
);

alter table event_bookmarks enable row level security;

create policy "event_bookmarks_select_own" on event_bookmarks
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "event_bookmarks_insert_own" on event_bookmarks
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "event_bookmarks_delete_own" on event_bookmarks
  for delete to authenticated
  using (user_id = (select auth.uid()));
