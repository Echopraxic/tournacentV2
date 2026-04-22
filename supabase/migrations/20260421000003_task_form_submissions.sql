CREATE TABLE IF NOT EXISTS task_form_submissions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  challenge_id uuid NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  form_id text NOT NULL,
  form_data jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE task_form_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own form submissions"
  ON task_form_submissions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can read own form submissions"
  ON task_form_submissions FOR SELECT
  USING (auth.uid() = user_id);
