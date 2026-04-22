/*
  Adds a CHECK constraint on task_form_submissions.form_id to enforce that
  only known form types can be stored. This provides a database-level backstop
  against unexpected values even if client-side validation is bypassed.
*/

ALTER TABLE task_form_submissions
  ADD CONSTRAINT task_form_submissions_form_id_check
  CHECK (form_id IN (
    'apr_calculator',
    'debt_avalanche',
    'investment_goal',
    'etf_research',
    'bill_audit',
    'annual_savings',
    'compound_growth'
  ));
