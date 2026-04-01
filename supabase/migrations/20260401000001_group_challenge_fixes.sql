/*
  # Group challenge fixes

  1. Fix activate_group_challenge trigger
     - Count only active (dropped_out_at IS NULL) participants toward the 3-player threshold
     - Prevents a dropped-out player's record from inflating the count and
       accidentally triggering activation with fewer than 3 real players

  2. delete_empty_challenge(p_challenge_id uuid) RPC
     - Called when the last active participant drops out
     - Verifies the caller is a participant and no other active players remain
     - Deletes all related rows in dependency order (task_completions, tasks,
       transactions, challenge_participants, challenges)
     - SECURITY DEFINER so it can delete rows owned by the challenge organizer
*/

-- ── 1. Fix activation trigger ────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION activate_group_challenge()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  p_count    int;
  c_type     text;
  c_status   text;
  c_duration int;
BEGIN
  SELECT challenge_type, status, duration_days
  INTO   c_type, c_status, c_duration
  FROM   challenges
  WHERE  id = NEW.challenge_id;

  IF c_type = 'group' AND c_status = 'pending' THEN
    -- Only count participants who have NOT dropped out
    SELECT COUNT(*) INTO p_count
    FROM   challenge_participants
    WHERE  challenge_id = NEW.challenge_id
      AND  dropped_out_at IS NULL;

    IF p_count >= 3 THEN
      UPDATE challenges SET
        status         = 'active',
        start_date     = now(),
        end_date       = now() + (c_duration || ' days')::interval,
        buyin_deadline = now() + interval '48 hours',
        join_deadline  = now() + interval '48 hours'
      WHERE id = NEW.challenge_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- ── 2. delete_empty_challenge RPC ────────────────────────────────────────────

CREATE OR REPLACE FUNCTION delete_empty_challenge(p_challenge_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Caller must be a participant (active or dropped-out)
  IF NOT EXISTS (
    SELECT 1 FROM challenge_participants
    WHERE  challenge_id = p_challenge_id
      AND  user_id      = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Not authorized to delete this challenge';
  END IF;

  -- No other active participants should remain
  IF EXISTS (
    SELECT 1 FROM challenge_participants
    WHERE  challenge_id  = p_challenge_id
      AND  user_id      <> auth.uid()
      AND  dropped_out_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Other active participants remain in this challenge';
  END IF;

  -- Delete in dependency order
  DELETE FROM task_completions      WHERE challenge_id = p_challenge_id;
  DELETE FROM tasks                 WHERE challenge_id = p_challenge_id;
  DELETE FROM transactions          WHERE challenge_id = p_challenge_id;
  DELETE FROM challenge_participants WHERE challenge_id = p_challenge_id;
  DELETE FROM challenges            WHERE id           = p_challenge_id;
END;
$$;

GRANT EXECUTE ON FUNCTION delete_empty_challenge(uuid) TO authenticated;
