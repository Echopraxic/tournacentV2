/*
  # Server-side automation via pg_cron

  Three scheduled jobs running every 30 minutes:

  1. cancel_expired_pending_challenges()
     - Hard-deletes group challenges that never reached 3 players before pending_expires_at
     - No refunds needed: pending challenges have no payments (payment_status = 'pending')
     - ON DELETE CASCADE handles all child rows (participants, tasks, completions, transactions)

  2. enforce_buyin_deadline()
     - Runs when an active challenge's buyin_deadline passes with fewer than 3 paid participants
     - Creates 'refund' transactions for any participants who had already paid
     - Marks those participants payment_status = 'refunded'
     - Sets challenge status = 'cancelled', prize_pool = 0

  3. process_completed_challenges()
     - Runs when an active challenge's end_date passes
     - Winner-takes-all; ties split the pool evenly
     - If top participant is disqualified, prize goes to next eligible rank
     - If every participant is disqualified, the app keeps the prize pool (no payout inserted)
     - Marks challenge status = 'completed'
*/

-- pg_cron must be enabled in Supabase Dashboard → Database → Extensions before running
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- ── 1. cancel_expired_pending_challenges ──────────────────────────────────────

CREATE OR REPLACE FUNCTION cancel_expired_pending_challenges()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Hard delete: ON DELETE CASCADE removes participants, tasks, completions, transactions
  DELETE FROM challenges
  WHERE status = 'pending'
    AND pending_expires_at IS NOT NULL
    AND pending_expires_at < now();
END;
$$;

-- Remove duplicate schedule if migration re-runs
SELECT cron.unschedule(jobid)
FROM cron.job
WHERE jobname = 'cancel-expired-pending-challenges';

SELECT cron.schedule(
  'cancel-expired-pending-challenges',
  '*/30 * * * *',
  'SELECT cancel_expired_pending_challenges()'
);

-- ── 2. enforce_buyin_deadline ─────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION enforce_buyin_deadline()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  c          RECORD;
  paid_count integer;
BEGIN
  FOR c IN
    SELECT id, buy_in_amount
    FROM challenges
    WHERE status = 'active'
      AND buyin_deadline IS NOT NULL
      AND buyin_deadline < now()
  LOOP
    SELECT COUNT(*) INTO paid_count
    FROM challenge_participants
    WHERE challenge_id   = c.id
      AND payment_status = 'paid'
      AND dropped_out_at IS NULL;

    IF paid_count < 3 THEN
      -- Refund participants who had already paid
      INSERT INTO transactions (user_id, challenge_id, amount, transaction_type, status)
      SELECT user_id, c.id, c.buy_in_amount, 'refund', 'verified'
      FROM challenge_participants
      WHERE challenge_id   = c.id
        AND payment_status = 'paid';

      UPDATE challenge_participants
      SET payment_status = 'refunded'
      WHERE challenge_id   = c.id
        AND payment_status = 'paid';

      UPDATE challenges
      SET status = 'cancelled', prize_pool = 0
      WHERE id = c.id;
    END IF;
  END LOOP;
END;
$$;

SELECT cron.unschedule(jobid)
FROM cron.job
WHERE jobname = 'enforce-buyin-deadline';

SELECT cron.schedule(
  'enforce-buyin-deadline',
  '*/30 * * * *',
  'SELECT enforce_buyin_deadline()'
);

-- ── 3. process_completed_challenges ──────────────────────────────────────────

CREATE OR REPLACE FUNCTION process_completed_challenges()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  c            RECORD;
  top_points   integer;
  winner_count integer;
  payout       numeric;
  w            RECORD;
BEGIN
  FOR c IN
    SELECT id, prize_pool
    FROM challenges
    WHERE status = 'active'
      AND end_date IS NOT NULL
      AND end_date < now()
  LOOP
    IF c.prize_pool > 0 THEN
      -- Find the highest score among eligible (not disqualified, not dropped out) participants
      SELECT MAX(points) INTO top_points
      FROM challenge_participants
      WHERE challenge_id    = c.id
        AND is_disqualified = false
        AND dropped_out_at  IS NULL;

      -- top_points IS NULL means every participant is disqualified → app keeps the pool
      IF top_points IS NOT NULL THEN
        SELECT COUNT(*) INTO winner_count
        FROM challenge_participants
        WHERE challenge_id    = c.id
          AND points          = top_points
          AND is_disqualified = false
          AND dropped_out_at  IS NULL;

        payout := c.prize_pool / winner_count;

        FOR w IN
          SELECT user_id
          FROM challenge_participants
          WHERE challenge_id    = c.id
            AND points          = top_points
            AND is_disqualified = false
            AND dropped_out_at  IS NULL
        LOOP
          INSERT INTO transactions (user_id, challenge_id, amount, transaction_type, status)
          VALUES (w.user_id, c.id, payout, 'payout', 'verified');
        END LOOP;
      END IF;
    END IF;

    UPDATE challenges SET status = 'completed' WHERE id = c.id;
  END LOOP;
END;
$$;

SELECT cron.unschedule(jobid)
FROM cron.job
WHERE jobname = 'process-completed-challenges';

SELECT cron.schedule(
  'process-completed-challenges',
  '*/30 * * * *',
  'SELECT process_completed_challenges()'
);
