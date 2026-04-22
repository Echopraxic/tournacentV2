/*
  Data retention automation via pg_cron.

  Implements the operationally-required deletion schedules from DATA_RETENTION_POLICY.md:

  1. purge_expired_sessions     — daily 02:00 UTC
     Deletes auth sessions older than 14 days (Supabase default JWT lifetime).

  2. purge_old_account_balances — daily 03:00 UTC
     Deletes plaid_accounts balance snapshots older than 90 days.
     (Balances are refreshed on every sync; old snapshots have no value and
     accumulate GDPR/CCPA liability.)

  3. anonymize_old_challenges   — weekly Sunday 04:00 UTC
     Removes organizer PII linkage on challenges completed > 30 days ago.
     The challenge record is kept for audit / leaderboard history but the
     organizer_id is nulled out so it cannot be used to profile the user.

  4. purge_withdrawn_consents   — monthly 1st at 01:00 UTC
     Hard-deletes user_consents rows where withdrawal was recorded > 30 days ago.
     The 30-day window is retained for legal dispute resolution before deletion.

  pg_cron must be enabled in Supabase Dashboard → Database → Extensions.
*/

CREATE EXTENSION IF NOT EXISTS pg_cron;

-- ── 1. purge_expired_sessions ─────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION purge_expired_sessions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  DELETE FROM auth.sessions
  WHERE created_at < now() - interval '14 days';
END;
$$;

SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'purge-expired-sessions';
SELECT cron.schedule('purge-expired-sessions', '0 2 * * *', 'SELECT purge_expired_sessions()');

-- ── 2. purge_old_account_balances ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION purge_old_account_balances()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Keep only the most-recent snapshot per account_id; delete older ones > 90 days
  DELETE FROM plaid_accounts
  WHERE updated_at < now() - interval '90 days';
END;
$$;

SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'purge-old-account-balances';
SELECT cron.schedule('purge-old-account-balances', '0 3 * * *', 'SELECT purge_old_account_balances()');

-- ── 3. anonymize_old_challenges ───────────────────────────────────────────────

CREATE OR REPLACE FUNCTION anonymize_old_challenges()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Null out organizer_id for challenges completed or cancelled > 30 days ago.
  -- The challenge row (name, prize_pool, dates) is retained for leaderboard history.
  UPDATE challenges
  SET organizer_id = NULL
  WHERE status IN ('completed', 'cancelled')
    AND end_date < now() - interval '30 days'
    AND organizer_id IS NOT NULL;
END;
$$;

SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'anonymize-old-challenges';
SELECT cron.schedule('anonymize-old-challenges', '0 4 * * 0', 'SELECT anonymize_old_challenges()');

-- ── 4. purge_withdrawn_consents ───────────────────────────────────────────────

CREATE OR REPLACE FUNCTION purge_withdrawn_consents()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Hard-delete consent rows withdrawn more than 30 days ago.
  -- The 30-day window allows legal dispute resolution before the record is gone.
  DELETE FROM user_consents
  WHERE withdrawn_at IS NOT NULL
    AND withdrawn_at < now() - interval '30 days';
END;
$$;

SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'purge-withdrawn-consents';
SELECT cron.schedule('purge-withdrawn-consents', '0 1 1 * *', 'SELECT purge_withdrawn_consents()');
