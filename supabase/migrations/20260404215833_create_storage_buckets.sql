-- Storage buckets for file uploads.
-- avatars: public, profile pictures (image/*, 1MB)
-- post-media: public, feed post images/videos (image/video, 10MB)
-- voice-notes: private, chat voice messages (audio/*, 5MB)
-- resources: private, downloadable resource files (no type restriction)

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('avatars', 'avatars', true, 1048576, array['image/*']),
  ('post-media', 'post-media', true, 10485760, array['image/*', 'video/*']),
  ('voice-notes', 'voice-notes', false, 5242880, array['audio/*']),
  ('resources', 'resources', false, null, null);
