# Supabase Storage

## Overview

Supabase Storage provides file storage built on top of PostgreSQL with Row Level Security (RLS) policies. It supports organized buckets (public/private), direct uploads, signed URLs, resumable uploads, image transformations, and fine-grained access control — all through the same Supabase JS client.

For Decarb Connect, we'll use it for avatar uploads and any file management needs (e.g., resource attachments, community feed images).

## Installation

Already included with the Supabase client library:

```bash
npm install @supabase/supabase-js
```

## Configuration

### Environment Variables

- `VITE_SUPABASE_URL`: Your Supabase project URL (e.g., `https://<project-ref>.supabase.co`)
- `VITE_SUPABASE_ANON_KEY`: Your Supabase anonymous/public API key

### Initialization

```typescript
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)
```

Storage is accessed via `supabase.storage`.

## Key Patterns

### Creating a Bucket

Buckets are created via SQL migration or the JS client. For our app, use a migration:

```sql
-- In a Supabase migration file
insert into storage.buckets (id, name, public)
  values ('avatars', 'avatars', true);
```

Or via the JS client (e.g., in a seed script):

```typescript
const { data, error } = await supabase.storage.createBucket('avatars', {
  public: true,
  allowedMimeTypes: ['image/*'],
  fileSizeLimit: '1MB',  // Accepts string shorthand or bytes (e.g., 1024 * 1024)
})
```

**Public vs Private buckets:**
- **Public** (`public: true`): Files accessible via public URL without auth. Good for avatars.
- **Private** (`public: false`, default): Files require signed URLs or authenticated download. Good for sensitive documents.

### Uploading Files

```typescript
// Upload from a file input
const file = event.target.files[0]
const fileName = `${userId}/${Date.now()}_${file.name}`

const { data, error } = await supabase.storage
  .from('avatars')
  .upload(fileName, file, {
    cacheControl: '3600',
    upsert: true,  // Replace existing file at same path
  })

if (error) {
  console.error('Upload error:', error.message)
} else {
  console.log('Uploaded:', data.path)
}
```

### Getting a Public URL

For files in **public** buckets (synchronous, no network call):

```typescript
const { data } = supabase.storage
  .from('avatars')
  .getPublicUrl('userId/avatar.jpg')

console.log(data.publicUrl)
// https://<project>.supabase.co/storage/v1/object/public/avatars/userId/avatar.jpg
```

### Creating Signed URLs (Private Buckets)

For files in **private** buckets, generate a time-limited URL:

```typescript
const { data, error } = await supabase.storage
  .from('documents')
  .createSignedUrl('path/to/file.pdf', 60)  // expires in 60 seconds

console.log(data.signedUrl)
```

### Downloading Files

```typescript
const { data, error } = await supabase.storage
  .from('avatars')
  .download('userId/avatar.jpg')

// data is a Blob
```

### Deleting Files

```typescript
// Remove one or more files (max 1000 per call)
const { error } = await supabase.storage
  .from('avatars')
  .remove(['userId/old-avatar.jpg'])
```

### Moving / Copying Files

```typescript
// Move within the same bucket
await supabase.storage
  .from('avatars')
  .move('old/path.jpg', 'new/path.jpg')

// Move across buckets
await supabase.storage
  .from('avatars')
  .move('path.jpg', 'path.jpg', { destinationBucket: 'archive' })
```

### Image Transformations

Supabase can transform images on-the-fly (resize, adjust quality, format conversion). Works with both public URLs and downloads.

**Public URL with transform:**

```typescript
const { data } = supabase.storage
  .from('avatars')
  .getPublicUrl('avatar.jpg', {
    transform: {
      width: 200,
      height: 200,
      resize: 'cover',  // 'cover' | 'contain' | 'fill'
      quality: 75,       // 20-100 (default 80)
    },
  })
```

**Download with transform:**

```typescript
const { data, error } = await supabase.storage
  .from('avatars')
  .download('avatar.jpg', {
    transform: {
      width: 800,
      height: 300,
      resize: 'contain',
    },
  })
```

**Signed URL with transform:**

```typescript
const { data } = await supabase.storage
  .from('bucket')
  .createSignedUrl('image.jpg', 60000, {
    transform: {
      width: 200,
      height: 200,
    },
  })
```

**Resize modes:**
| Mode | Behavior |
|------|----------|
| `cover` | Fills dimensions, crops overflow (default) |
| `contain` | Fits within dimensions, preserves aspect ratio |
| `fill` | Stretches to fill, ignores aspect ratio |

### Presigned Upload URLs

Allow unauthenticated clients to upload via a token (useful for sharing upload capability):

```typescript
// Server-side: create the signed upload URL
const { data } = await supabase.storage
  .from('bucket')
  .createSignedUploadUrl('path/file.txt', { upsert: true })

// Client-side: upload using the token
await supabase.storage
  .from('bucket')
  .uploadToSignedUrl('path/file.txt', data.token, file)
```

## RLS Policies for Storage

Storage access is controlled via RLS on the `storage.objects` table. **By default, no uploads are allowed** — you must create policies explicitly.

### Avatar Upload/Read Policies (Recommended for Decarb Connect)

```sql
-- Anyone can view avatars (public bucket)
create policy "Avatar images are publicly accessible."
  on storage.objects for select
  using (bucket_id = 'avatars');

-- Authenticated users can upload their own avatar
create policy "Users can upload their own avatar."
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

-- Users can update (replace) their own avatar
create policy "Users can update their own avatar."
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (select auth.uid()) = owner
  );

-- Users can delete their own avatar
create policy "Users can delete their own avatar."
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and (select auth.uid()) = owner
  );
```

### Restrict File Types via RLS

```sql
create policy "Only allow image uploads"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and storage.extension(name) in ('png', 'jpg', 'jpeg', 'gif', 'webp')
  );
```

### Helper Functions for RLS

| Function | Returns | Example |
|----------|---------|---------|
| `storage.filename(name)` | File name from path | `avatar.png` |
| `storage.foldername(name)` | Array of folder segments | `['userId', 'subfolder']` |
| `storage.extension(name)` | File extension | `png` |

## API Reference

| Method | Description | Returns |
|--------|-------------|---------|
| `createBucket(id, options?)` | Create a new bucket | `{ data, error }` |
| `getBucket(id)` | Get bucket details | `{ data, error }` |
| `listBuckets()` | List all buckets | `{ data, error }` |
| `deleteBucket(id)` | Delete an empty bucket | `{ data, error }` |
| `emptyBucket(id)` | Remove all files in a bucket | `{ data, error }` |
| `from(bucket).upload(path, file, options?)` | Upload a file | `{ data: { path }, error }` |
| `from(bucket).download(path, options?)` | Download a file | `{ data: Blob, error }` |
| `from(bucket).getPublicUrl(path, options?)` | Get public URL (sync) | `{ data: { publicUrl } }` |
| `from(bucket).createSignedUrl(path, expiresIn, options?)` | Create time-limited URL | `{ data: { signedUrl }, error }` |
| `from(bucket).createSignedUrls(paths, expiresIn)` | Batch signed URLs | `{ data, error }` |
| `from(bucket).remove(paths[])` | Delete files (max 1000) | `{ data, error }` |
| `from(bucket).move(from, to, options?)` | Move a file | `{ data, error }` |
| `from(bucket).copy(from, to, options?)` | Copy a file | `{ data, error }` |
| `from(bucket).list(folder?, options?)` | List files in a path | `{ data, error }` |
| `from(bucket).createSignedUploadUrl(path)` | Presigned upload URL | `{ data: { token }, error }` |
| `from(bucket).uploadToSignedUrl(path, token, file)` | Upload via presigned token | `{ data, error }` |

## Gotchas

- **No uploads without RLS policies.** Storage blocks all operations by default. You must create explicit RLS policies on `storage.objects`.
- **`remove()` is limited to 1000 files per call.** Batch larger deletions.
- **`getPublicUrl()` only works for public buckets.** For private buckets, use `createSignedUrl()`.
- **`getPublicUrl()` doesn't validate the file exists.** It returns a URL regardless — no network request is made.
- **`upsert: false` (default) will error if file already exists.** Set `upsert: true` for avatar replacement workflows.
- **Image transformation limits:** Max 25MB file size, max 50MP resolution, width/height 1–2500px.
- **Transformation options in signed URLs are immutable.** Once signed, the transform params cannot be changed.
- **Folder-based RLS:** Use `(storage.foldername(name))[1]` to scope uploads to user-specific folders (e.g., `userId/avatar.jpg`).
- **Cache control:** Set `cacheControl` on upload (default is no caching). Use `'3600'` (1 hour) for avatars.
- **MIME type validation** can be enforced at bucket level (`allowedMimeTypes`) AND/OR via RLS policies — use both for defense in depth.

## Rate Limits

- File uploads: subject to Supabase project plan limits
- Image transformations: billed per transformation, cached at CDN after first request
- Signed URLs: no rate limit on creation, but the URL itself expires per `expiresIn` param

## References

- [Supabase Storage Overview](https://supabase.com/docs/guides/storage)
- [Storage Quickstart](https://supabase.com/docs/guides/storage/quickstart)
- [Access Control / RLS](https://supabase.com/docs/guides/storage/security/access-control)
- [Image Transformations](https://supabase.com/docs/guides/storage/serving/image-transformations)
- [Helper Functions (filename, foldername, extension)](https://supabase.com/docs/guides/storage/schema/helper-functions)
- [Resumable Uploads](https://supabase.com/docs/guides/storage/uploads/resumable-uploads)
