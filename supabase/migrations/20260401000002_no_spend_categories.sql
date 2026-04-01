/*
  # No-Spend Category Declaration

  1. user_no_spend_categories table
     - Stores the 3 Plaid spending categories each user declares to avoid per challenge
     - Used by verifyNoSpendTask (client) and the plaid-webhook (server) for disqualification

  2. New task type: 'no_spend_declare'
     - Separates the "Declare 3 categories" setup task from the streak verification tasks
     - The setup task shows a category picker UI; streak tasks run Plaid verification

  3. Update seeded template tasks
     - "Declare 3 Spending Categories to Avoid" task_type → 'no_spend_declare'
*/

-- ── 1. user_no_spend_categories ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_no_spend_categories (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  challenge_id uuid        NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  plaid_category text      NOT NULL,
  created_at   timestamptz DEFAULT now(),
  UNIQUE(user_id, challenge_id, plaid_category)
);

ALTER TABLE user_no_spend_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own no-spend categories"
  ON user_no_spend_categories FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own no-spend categories"
  ON user_no_spend_categories FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own no-spend categories"
  ON user_no_spend_categories FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ── 2. Add 'no_spend_declare' to task_type constraint ─────────────────────────

ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_task_type_check;

ALTER TABLE tasks ADD CONSTRAINT tasks_task_type_check
  CHECK (task_type IN (
    'budget', 'tracking', 'cooking', 'subscription',
    'reading', 'savings', 'no_spend', 'no_spend_declare', 'custom'
  ));

-- ── 3. Update seeded template tasks ──────────────────────────────────────────

UPDATE tasks
SET task_type = 'no_spend_declare'
WHERE title = 'Declare 3 Spending Categories to Avoid'
  AND task_type = 'no_spend';
