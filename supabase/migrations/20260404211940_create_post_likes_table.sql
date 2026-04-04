-- Post likes junction table: mirrors Firestore `posts/{id}/likes` subcollection.
-- Tracks which user liked which post. Composite PK prevents duplicate likes.

create table public.post_likes (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (post_id, user_id)
);

-- RLS
alter table public.post_likes enable row level security;

-- SELECT: any authenticated user can see all likes
create policy "Authenticated users can view all post likes"
  on public.post_likes for select
  to authenticated
  using ( true );

-- INSERT: users can only like as themselves
create policy "Users can insert own post likes"
  on public.post_likes for insert
  to authenticated
  with check ( (select auth.uid()) = user_id );

-- DELETE: users can only remove their own likes
create policy "Users can delete own post likes"
  on public.post_likes for delete
  to authenticated
  using ( (select auth.uid()) = user_id );
