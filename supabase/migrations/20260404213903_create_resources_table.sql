-- Resources table: mirrors Firestore `resources` collection.
-- Stores videos, reports, and insights for the resource library.
-- Admin-only write access; all authenticated users can read.

create table public.resources (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null,
  type text not null check (type in ('Video', 'Report', 'Insight')),
  category text not null,
  author text not null,
  duration text,
  stats text,
  image_url text,
  icon text,
  created_at timestamptz default now()
);

-- RLS
alter table public.resources enable row level security;

-- SELECT: any authenticated user can read all resources
create policy "Authenticated users can view all resources"
  on public.resources for select
  to authenticated
  using ( true );

-- INSERT: admins only
create policy "Admins can insert resources"
  on public.resources for insert
  to authenticated
  with check ( public.is_admin() );

-- UPDATE: admins only
create policy "Admins can update resources"
  on public.resources for update
  to authenticated
  using ( public.is_admin() )
  with check ( public.is_admin() );

-- DELETE: admins only
create policy "Admins can delete resources"
  on public.resources for delete
  to authenticated
  using ( public.is_admin() );
