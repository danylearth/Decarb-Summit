-- Storage RLS policies for all four buckets.
-- Without these policies, Supabase Storage blocks ALL operations by default.
--
-- Buckets:
--   avatars    (public)  — anyone can view, authenticated users manage own folder
--   post-media (public)  — anyone can view, authenticated users manage own folder
--   voice-notes (private) — authenticated users manage own folder only
--   resources  (private) — authenticated users can read, admins manage

-- ============================================================
-- AVATARS (public bucket)
-- ============================================================

-- Anyone can view avatars (public bucket)
create policy "Avatars are publicly accessible"
  on storage.objects for select
  using (bucket_id = 'avatars');

-- Users upload to their own folder: avatars/{uid}/*
create policy "Users can upload their own avatar"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

-- Users can replace their own avatar
create policy "Users can update their own avatar"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

-- Users can delete their own avatar
create policy "Users can delete their own avatar"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

-- ============================================================
-- POST-MEDIA (public bucket)
-- ============================================================

-- Anyone can view post media (public bucket)
create policy "Post media is publicly accessible"
  on storage.objects for select
  using (bucket_id = 'post-media');

-- Users upload to their own folder: post-media/{uid}/*
create policy "Users can upload their own post media"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'post-media'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

-- Users can replace their own post media
create policy "Users can update their own post media"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'post-media'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

-- Users can delete their own post media
create policy "Users can delete their own post media"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'post-media'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

-- ============================================================
-- VOICE-NOTES (private bucket)
-- ============================================================

-- Authenticated users can read voice notes (recipients need access to sender's files;
-- URLs are only exposed via the RLS-protected messages table)
create policy "Authenticated users can read voice notes"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'voice-notes');

-- Users upload to their own folder: voice-notes/{uid}/*
create policy "Users can upload their own voice notes"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'voice-notes'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

-- Users can replace their own voice notes
create policy "Users can update their own voice notes"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'voice-notes'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

-- Users can delete their own voice notes
create policy "Users can delete their own voice notes"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'voice-notes'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

-- ============================================================
-- RESOURCES (private bucket — admin-managed, authenticated read)
-- ============================================================

-- Authenticated users can download resources
create policy "Authenticated users can read resources"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'resources');

-- Only admins can upload resources
create policy "Admins can upload resources"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'resources'
    and is_admin(auth.uid())
  );

-- Only admins can update resources
create policy "Admins can update resources"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'resources'
    and is_admin(auth.uid())
  );

-- Only admins can delete resources
create policy "Admins can delete resources"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'resources'
    and is_admin(auth.uid())
  );
