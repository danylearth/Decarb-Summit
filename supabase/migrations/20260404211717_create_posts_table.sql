-- Posts table: mirrors Firestore `posts` collection.
-- Each post belongs to a profile (author).

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  content text not null,
  media_url text,
  media_type text check (media_type in ('image', 'video')),
  likes_count integer default 0,
  comments_count integer default 0,
  is_sponsored boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Auto-update updated_at on every UPDATE
create trigger posts_set_updated_at
  before update on public.posts
  for each row
  execute function public.set_updated_at();

-- RLS
alter table public.posts enable row level security;

-- SELECT: any authenticated user can read all posts
create policy "Authenticated users can view all posts"
  on public.posts for select
  to authenticated
  using ( true );

-- INSERT: users can only insert posts as themselves
create policy "Users can insert own posts"
  on public.posts for insert
  to authenticated
  with check ( (select auth.uid()) = author_id );

-- UPDATE: users can update their own posts
create policy "Users can update own posts"
  on public.posts for update
  to authenticated
  using ( (select auth.uid()) = author_id )
  with check ( (select auth.uid()) = author_id );

-- UPDATE: admins can update any post
create policy "Admins can update any post"
  on public.posts for update
  to authenticated
  using ( public.is_admin() )
  with check ( public.is_admin() );

-- DELETE: users can delete their own posts
create policy "Users can delete own posts"
  on public.posts for delete
  to authenticated
  using ( (select auth.uid()) = author_id );

-- DELETE: admins can delete any post
create policy "Admins can delete any post"
  on public.posts for delete
  to authenticated
  using ( public.is_admin() );
