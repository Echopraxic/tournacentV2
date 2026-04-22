/*
  Adds date_of_birth to profiles for COPPA compliance.

  - Nullable so existing rows are unaffected (profiles created before this
    migration will not have a DOB; the app enforces collection at signup).
  - CHECK constraint provides a database-level backstop ensuring no profile
    can be created for a user under 13 years old, even if client-side
    validation is bypassed.
*/

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS date_of_birth date;

ALTER TABLE profiles
  ADD CONSTRAINT profiles_min_age_check
  CHECK (
    date_of_birth IS NULL
    OR date_of_birth <= current_date - interval '13 years'
  );
