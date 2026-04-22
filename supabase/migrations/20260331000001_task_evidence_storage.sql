/*
  # Task evidence: storage bucket + evidence_url column

  Adds screenshot upload support for tasks that require visual proof
  (e.g. "Cancel One Subscription" — user uploads a cancellation email screenshot).

  Changes:
  1. Add evidence_url column to task_completions
  2. Create private storage bucket 'task-evidence'
  3. RLS: users can only upload/read files under their own user_id folder

  ──────────────────────────────────────────────────────────────────────────────
  PATH FORMAT CONTRACT (must not change without updating RLS below):

    task-evidence/{user_id}/{task_id}/{filename}

  RLS verifies (storage.foldername(name))[1] = auth.uid()::text, meaning the
  FIRST path segment must be the authenticated user's UUID.

  ⚠️  If the upload path format ever changes (e.g. {challengeId}/{userId}/...),
      update ALL three storage policies in this migration to match the new
      segment index, otherwise cross-user access will be silently permitted.
  ──────────────────────────────────────────────────────────────────────────────
*/

-- Add evidence_url to task_completions
ALTER TABLE task_completions ADD COLUMN IF NOT EXISTS evidence_url text;

-- Create private bucket (10 MB limit, images only)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'task-evidence',
  'task-evidence',
  false,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
ON CONFLICT (id) DO NOTHING;

-- Users may upload files only inside their own folder ({user_id}/...)
CREATE POLICY "Users upload own evidence"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'task-evidence'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Users may overwrite their own files (upsert support)
CREATE POLICY "Users update own evidence"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'task-evidence'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Users may read their own files
CREATE POLICY "Users view own evidence"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'task-evidence'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
