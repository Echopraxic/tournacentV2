CREATE TABLE IF NOT EXISTS task_quiz_submissions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  challenge_id uuid NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  quiz_id text NOT NULL,
  answers jsonb NOT NULL DEFAULT '{}',
  score integer NOT NULL,
  profile_label text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE task_quiz_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own quiz submissions"
  ON task_quiz_submissions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can read own quiz submissions"
  ON task_quiz_submissions FOR SELECT
  USING (auth.uid() = user_id);
