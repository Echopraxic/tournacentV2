/*
  # Add verification_type and form_id columns to tasks

  Separates task color coding (task_type) from completion behavior
  (verification_type). Values: plaid, photo, self_report, form, quiz,
  counter, text.

  Also truncates existing task data so re-created challenges pick up
  the correct verification_type from the updated preset definitions.
  (Safe to do — dev environment, no production data.)
*/

TRUNCATE tasks CASCADE;

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS verification_type text NOT NULL DEFAULT 'self_report';

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS form_id text;
