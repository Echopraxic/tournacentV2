/*
  # drop_out_of_challenge(p_challenge_id uuid)

  Replaces the client-side dropout logic which was unreliable due to RLS
  silently blocking writes and returning { error: null, data: [] }.

  This function runs as SECURITY DEFINER (bypasses RLS) and handles both cases
  atomically:

  - Solo / last active participant → hard-deletes the challenge and all related
    rows in dependency order (task_completions, tasks, transactions,
    challenge_participants, challenges).

  - Group with others remaining → sets dropped_out_at = now() on the caller's
    participation row only.

  Returns a jsonb object:
    { "success": true,  "action": "deleted"    }   -- solo / last person
    { "success": true,  "action": "dropped_out" }  -- group dropout
    { "success": false, "error":  "<reason>"    }  -- validation failure

  Errors from RAISE EXCEPTION (unexpected DB errors) propagate normally and
  are surfaced to the client as Supabase error objects.
*/

CREATE OR REPLACE FUNCTION drop_out_of_challenge(p_challenge_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id     uuid := auth.uid();
  v_other_count int;
BEGIN
  -- Reject unauthenticated calls
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- Verify the caller is currently an active participant
  IF NOT EXISTS (
    SELECT 1 FROM challenge_participants
    WHERE  challenge_id  = p_challenge_id
      AND  user_id       = v_user_id
      AND  dropped_out_at IS NULL
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error',   'You are not an active participant in this challenge'
    );
  END IF;

  -- Count other active participants
  SELECT COUNT(*)
  INTO   v_other_count
  FROM   challenge_participants
  WHERE  challenge_id  = p_challenge_id
    AND  user_id      <> v_user_id
    AND  dropped_out_at IS NULL;

  IF v_other_count = 0 THEN
    -- ── Solo / last person: hard-delete everything ──────────────────────────
    DELETE FROM task_completions       WHERE challenge_id = p_challenge_id;
    DELETE FROM tasks                  WHERE challenge_id = p_challenge_id;
    DELETE FROM transactions           WHERE challenge_id = p_challenge_id;
    DELETE FROM challenge_participants WHERE challenge_id = p_challenge_id;
    DELETE FROM challenges             WHERE id           = p_challenge_id;

    RETURN jsonb_build_object('success', true, 'action', 'deleted');

  ELSE
    -- ── Group with others: soft-delete the caller's row ─────────────────────
    UPDATE challenge_participants
    SET    dropped_out_at = now()
    WHERE  challenge_id  = p_challenge_id
      AND  user_id       = v_user_id;

    RETURN jsonb_build_object('success', true, 'action', 'dropped_out');
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION drop_out_of_challenge(uuid) TO authenticated;
