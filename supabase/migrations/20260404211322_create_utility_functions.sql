-- Utility functions used by all table migrations.
-- This migration MUST remain the earliest in timestamp order.
-- Note: is_admin() lives in the profiles migration since it queries the profiles table.

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
