-- Post comments table: mirrors Firestore `posts/{id}/comments` subcollection.
-- Each comment belongs to a post and a profile (author).

create table public.post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  content text not null,
  is_edited boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Auto-update updated_at on every UPDATE
create trigger post_comments_set_updated_at
  before update on public.post_comments
  for each row
  execute function public.set_updated_at();

-- RLS
alter table public.post_comments enable row level security;

-- SELECT: any authenticated user can read all comments
create policy "Authenticated users can view all post comments"
  on public.post_comments for select
  to authenticated
  using ( true );

-- INSERT: users can only insert comments as themselves
create policy "Users can insert own post comments"
  on public.post_comments for insert
  to authenticated
  with check ( (select auth.uid()) = author_id );

-- UPDATE: users can update their own comments (content and is_edited only)
create policy "Users can update own post comments"
  on public.post_comments for update
  to authenticated
  using ( (select auth.uid()) = author_id )
  with check ( (select auth.uid()) = author_id );

-- DELETE: users can delete their own comments
create policy "Users can delete own post comments"
  on public.post_comments for delete
  to authenticated
  using ( (select auth.uid()) = author_id );

-- DELETE: admins can delete any comment
create policy "Admins can delete any post comment"
  on public.post_comments for delete
  to authenticated
  using ( public.is_admin() );
