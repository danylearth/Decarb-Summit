-- Add voice note and attachment support to messages table
-- Needed for ChatPage migration: voice notes store URL/duration in the message row,
-- attachments store file metadata as JSONB. Content is made nullable for voice-only messages.

ALTER TABLE public.messages ALTER COLUMN content DROP NOT NULL;

ALTER TABLE public.messages
  ADD COLUMN voice_note_url text,
  ADD COLUMN voice_note_duration text,
  ADD COLUMN attachments jsonb DEFAULT '[]'::jsonb;

-- Index for efficient conversation queries: fetch messages between two specific users
CREATE INDEX idx_messages_conversation
  ON public.messages (sender_id, receiver_id, created_at);
