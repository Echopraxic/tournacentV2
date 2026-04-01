/*
  # Fix infinite recursion in challenge_participants RLS + missing no_spend task type

  ## Problems

  1. The SELECT policy on challenge_participants queries challenge_participants
     to check membership, which triggers the same policy recursively.

  2. The task_type CHECK constraint is missing 'no_spend', blocking preset task inserts.

  ## Fixes

  1. Replace the recursive SELECT policy with one backed by a SECURITY DEFINER
     function. The function runs as its owner and bypasses RLS for its inner
     query, breaking the recursion.

  2. Drop and recreate the task_type CHECK constraint to include 'no_spend'.
*/

-- ── Fix 1: recursive challenge_participants SELECT policy ─────────────────────

-- Helper that checks membership without triggering RLS on challenge_participants
CREATE OR REPLACE FUNCTION user_is_challenge_participant(cid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM challenge_participants
    WHERE challenge_id = cid
      AND user_id = auth.uid()
  );
$$;

-- Drop the recursive policy and replace it
DROP POLICY IF EXISTS "Participants can view challenge participants" ON challenge_participants;

CREATE POLICY "Participants can view challenge participants"
  ON challenge_participants FOR SELECT
  TO authenticated
  USING (user_is_challenge_participant(challenge_id));

-- ── Fix 2: add no_spend to task_type CHECK constraint ────────────────────────

ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_task_type_check;

ALTER TABLE tasks ADD CONSTRAINT tasks_task_type_check
  CHECK (task_type IN (
    'budget', 'tracking', 'cooking', 'subscription',
    'reading', 'savings', 'no_spend', 'custom'
  ));
