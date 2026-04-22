/*
  delete_user_data() — hard-delete all data owned by the calling user.

  Called from wallet.tsx "Delete Account" flow after the user confirms the
  destructive alert. The function runs as SECURITY DEFINER so it can reach
  tables that are normally read-only for the authenticated role, but it still
  scopes every DELETE / UPDATE to auth.uid() so it cannot be mis-used to
  delete another user's data.

  Deletion order respects FK constraints:
    1. Submission tables (leaf nodes — FK to task_completions)
    2. task_completions (FK to challenge_participants)
    3. challenge_participants
    4. bank_transactions / plaid_accounts / plaid_items / user_consents / transactions
    5. profiles (if present — some setups cascade from auth.users, some don't)
    6. auth.users — cascades to all auth.* tables automatically

  Storage objects are deleted via the storage.objects table which Edge Functions
  and the Supabase storage API write to. Rows in storage.objects whose name
  starts with "{user_id}/" are removed; the actual bytes are garbage-collected
  by Supabase's storage background worker.
*/

CREATE OR REPLACE FUNCTION delete_user_data()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, storage
AS $$
DECLARE
  _uid uuid := auth.uid();
  _deleted jsonb := '{}'::jsonb;
  _n       int;
BEGIN
  -- Must be called by an authenticated user
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'delete_user_data: not authenticated';
  END IF;

  -- ── 1. Submission leaf tables ──────────────────────────────────────────────

  DELETE FROM task_form_submissions   WHERE user_id = _uid;
  GET DIAGNOSTICS _n = ROW_COUNT;
  _deleted := _deleted || jsonb_build_object('task_form_submissions', _n);

  DELETE FROM task_quiz_submissions   WHERE user_id = _uid;
  GET DIAGNOSTICS _n = ROW_COUNT;
  _deleted := _deleted || jsonb_build_object('task_quiz_submissions', _n);

  DELETE FROM task_counters           WHERE user_id = _uid;
  GET DIAGNOSTICS _n = ROW_COUNT;
  _deleted := _deleted || jsonb_build_object('task_counters', _n);

  DELETE FROM task_text_submissions   WHERE user_id = _uid;
  GET DIAGNOSTICS _n = ROW_COUNT;
  _deleted := _deleted || jsonb_build_object('task_text_submissions', _n);

  DELETE FROM task_evidence           WHERE user_id = _uid;
  GET DIAGNOSTICS _n = ROW_COUNT;
  _deleted := _deleted || jsonb_build_object('task_evidence', _n);

  -- ── 2. task_completions ────────────────────────────────────────────────────

  DELETE FROM task_completions        WHERE user_id = _uid;
  GET DIAGNOSTICS _n = ROW_COUNT;
  _deleted := _deleted || jsonb_build_object('task_completions', _n);

  -- ── 3. challenge_participants ──────────────────────────────────────────────

  DELETE FROM challenge_participants  WHERE user_id = _uid;
  GET DIAGNOSTICS _n = ROW_COUNT;
  _deleted := _deleted || jsonb_build_object('challenge_participants', _n);

  -- ── 4. Financial / Plaid data ──────────────────────────────────────────────

  DELETE FROM bank_transactions       WHERE user_id = _uid;
  GET DIAGNOSTICS _n = ROW_COUNT;
  _deleted := _deleted || jsonb_build_object('bank_transactions', _n);

  DELETE FROM plaid_accounts          WHERE user_id = _uid;
  GET DIAGNOSTICS _n = ROW_COUNT;
  _deleted := _deleted || jsonb_build_object('plaid_accounts', _n);

  DELETE FROM plaid_items             WHERE user_id = _uid;
  GET DIAGNOSTICS _n = ROW_COUNT;
  _deleted := _deleted || jsonb_build_object('plaid_items', _n);

  DELETE FROM transactions            WHERE user_id = _uid;
  GET DIAGNOSTICS _n = ROW_COUNT;
  _deleted := _deleted || jsonb_build_object('transactions', _n);

  -- ── 5. Consent records ─────────────────────────────────────────────────────

  DELETE FROM user_consents           WHERE user_id = _uid;
  GET DIAGNOSTICS _n = ROW_COUNT;
  _deleted := _deleted || jsonb_build_object('user_consents', _n);

  -- ── 6. Storage objects ─────────────────────────────────────────────────────
  -- Deletes metadata rows; Supabase storage GC cleans up the actual bytes.
  -- Path convention: task-evidence/{user_id}/...
  DELETE FROM storage.objects
  WHERE bucket_id = 'task-evidence'
    AND (storage.foldername(name))[1] = _uid::text;
  GET DIAGNOSTICS _n = ROW_COUNT;
  _deleted := _deleted || jsonb_build_object('storage_objects', _n);

  -- ── 7. Profile ─────────────────────────────────────────────────────────────

  DELETE FROM profiles                WHERE id = _uid;
  GET DIAGNOSTICS _n = ROW_COUNT;
  _deleted := _deleted || jsonb_build_object('profiles', _n);

  -- ── 8. Auth user (cascades to auth.sessions, auth.identities, etc.) ────────

  DELETE FROM auth.users              WHERE id = _uid;

  RETURN jsonb_build_object(
    'success', true,
    'deleted', _deleted
  );
END;
$$;

-- Only authenticated users may call this; service_role can too (for admin tooling)
REVOKE EXECUTE ON FUNCTION delete_user_data() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION delete_user_data() TO authenticated;
GRANT  EXECUTE ON FUNCTION delete_user_data() TO service_role;
