-- P3.0d: questions table (live Q&A for sessions)
create table questions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references events(id) on delete cascade not null,
  author_id uuid references profiles(id) on delete cascade not null,
  content text not null,
  upvotes int default 0,
  is_highlighted boolean default false,
  created_at timestamptz default now()
);

alter table questions enable row level security;

-- Anyone authenticated can view questions
create policy "questions_select" on questions
  for select to authenticated
  using (true);

-- Users can insert their own questions
create policy "questions_insert_own" on questions
  for insert to authenticated
  with check (author_id = (select auth.uid()));

-- Only admins can update (highlight, moderate)
create policy "questions_update_admin" on questions
  for update to authenticated
  using (is_admin());

-- Authors can delete their own, admins can delete any
create policy "questions_delete_own" on questions
  for delete to authenticated
  using (author_id = (select auth.uid()) or is_admin());
