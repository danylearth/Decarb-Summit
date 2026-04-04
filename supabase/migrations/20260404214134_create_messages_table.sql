-- Messages table: mirrors Firestore `messages` collection.
-- Each message has a sender and receiver, both referencing profiles.

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  receiver_id uuid not null references public.profiles(id) on delete cascade,
  content text not null,
  is_read boolean default false,
  created_at timestamptz default now()
);

-- RLS
alter table public.messages enable row level security;

-- SELECT: users can only read messages they sent or received
create policy "Users can view own messages"
  on public.messages for select
  to authenticated
  using ( (select auth.uid()) in (sender_id, receiver_id) );

-- INSERT: users can only insert messages as the sender
create policy "Users can insert messages as sender"
  on public.messages for insert
  to authenticated
  with check ( (select auth.uid()) = sender_id );

-- UPDATE: only the receiver can update is_read
create policy "Receivers can update is_read"
  on public.messages for update
  to authenticated
  using ( (select auth.uid()) = receiver_id )
  with check ( (select auth.uid()) = receiver_id );
