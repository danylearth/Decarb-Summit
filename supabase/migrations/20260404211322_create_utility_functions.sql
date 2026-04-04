-- Utility functions used by all table migrations.
-- This migration MUST remain the earliest in timestamp order.

-- Trigger function: automatically set updated_at to now() on UPDATE
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Helper function: returns true if the current authenticated user is an admin
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and is_admin = true
  );
$$;
