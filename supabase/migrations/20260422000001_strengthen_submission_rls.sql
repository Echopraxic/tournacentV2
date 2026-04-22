/*
  Strengthen RLS on task submission tables with challenge_id context.

  Previously the SELECT policies only checked user_id, meaning a user could
  technically read their own submissions from any challenge via a direct query,
  even for challenges they've since left. Adding an EXISTS check on
  challenge_participants enforces that the user must be an active participant
  in the specific challenge the submission belongs to.

  Affected tables:
    - task_form_submissions
    - task_quiz_submissions
    - task_counters
    - task_text_submissions
*/

-- ── task_form_submissions ─────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Users can read own form submissions" ON task_form_submissions;

CREATE POLICY "Users can read own form submissions"
  ON task_form_submissions FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM challenge_participants
      WHERE challenge_participants.challenge_id = task_form_submissions.challenge_id
        AND challenge_participants.user_id = auth.uid()
    )
  );

-- ── task_quiz_submissions ─────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Users can read own quiz submissions" ON task_quiz_submissions;

CREATE POLICY "Users can read own quiz submissions"
  ON task_quiz_submissions FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM challenge_participants
      WHERE challenge_participants.challenge_id = task_quiz_submissions.challenge_id
        AND challenge_participants.user_id = auth.uid()
    )
  );

-- ── task_counters ─────────────────────────────────────────────────────────────
-- Previously used a single FOR ALL policy. Replace with separate SELECT (with
-- challenge context) and INSERT/UPDATE (user_id only is fine for writes).

DROP POLICY IF EXISTS "Users can manage own counters" ON task_counters;

CREATE POLICY "Users can read own counters"
  ON task_counters FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM challenge_participants
      WHERE challenge_participants.challenge_id = task_counters.challenge_id
        AND challenge_participants.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own counters"
  ON task_counters FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own counters"
  ON task_counters FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── task_text_submissions ─────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Users can read own text submissions" ON task_text_submissions;

CREATE POLICY "Users can read own text submissions"
  ON task_text_submissions FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM challenge_participants
      WHERE challenge_participants.challenge_id = task_text_submissions.challenge_id
        AND challenge_participants.user_id = auth.uid()
    )
  );
