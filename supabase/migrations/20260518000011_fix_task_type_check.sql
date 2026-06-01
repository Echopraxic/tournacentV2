/*
  Fix tasks_task_type_check: it was missing 'debt_payment', 'investment', and
  'negotiation', even though the preset challenges (debt-destroyer, investment-
  starter, bill-negotiation, mini-rate-check) define tasks of these types and the
  verification logic already handles them. Any challenge built from those presets
  failed at task insert with a check-constraint violation.

  Widen the allowed set to match the PresetTask task_type union.
*/

ALTER TABLE tasks DROP CONSTRAINT tasks_task_type_check;

ALTER TABLE tasks
  ADD CONSTRAINT tasks_task_type_check CHECK (
    task_type = ANY (ARRAY[
      'budget', 'tracking', 'cooking', 'subscription', 'reading',
      'savings', 'no_spend', 'no_spend_declare', 'custom',
      'debt_payment', 'investment', 'negotiation'
    ])
  );
