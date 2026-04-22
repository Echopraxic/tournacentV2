/*
  # Wire up automated enforcement functions

  Two additions:

  1. process_completed_challenges() — replaced to add a mandatory-task
     disqualification step before payout. When a challenge's end_date is
     reached, any participant who has not completed every mandatory task is
     marked disqualified before winners are calculated.

  2. monitor_savings_withdrawals() — new nightly function (2 am daily via
     pg_cron). Sweeps all active savings-challenge participants and
     disqualifies any whose linked bank account shows a withdrawal that the
     real-time Plaid webhook may have missed (e.g. webhook outage, item
     reconnected after a gap).
*/

-- ── 1. process_completed_challenges (with mandatory-task disqualification) ────
--
-- Replaces the version from 20260401000003_cron_automation.sql.
-- New pre-payout step: for each ending challenge, check every non-disqualified
-- participant against the challenge's mandatory task list. Participants missing
-- any mandatory completion are disqualified before the winner is selected.

CREATE OR REPLACE FUNCTION process_completed_challenges()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  c              RECORD;
  p              RECORD;
  mandatory_ids  uuid[];
  completed_ids  uuid[];
  top_points     integer;
  winner_count   integer;
  payout         numeric;
  w              RECORD;
BEGIN
  FOR c IN
    SELECT id, prize_pool
    FROM challenges
    WHERE status  = 'active'
      AND end_date IS NOT NULL
      AND end_date < now()
  LOOP

    -- ── Step 1: disqualify participants with incomplete mandatory tasks ──────
    SELECT ARRAY_AGG(id) INTO mandatory_ids
    FROM tasks
    WHERE challenge_id = c.id
      AND is_mandatory = true;

    IF mandatory_ids IS NOT NULL THEN
      FOR p IN
        SELECT user_id
        FROM challenge_participants
        WHERE challenge_id    = c.id
          AND is_disqualified = false
          AND dropped_out_at  IS NULL
      LOOP
        SELECT ARRAY_AGG(task_id) INTO completed_ids
        FROM task_completions
        WHERE user_id      = p.user_id
          AND challenge_id = c.id
          AND task_id      = ANY(mandatory_ids);

        -- <@ checks that every mandatory ID is present in completed_ids
        IF completed_ids IS NULL OR NOT (mandatory_ids <@ completed_ids) THEN
          UPDATE challenge_participants
          SET is_disqualified         = true,
              disqualification_reason = 'Failed to complete all mandatory tasks'
          WHERE user_id      = p.user_id
            AND challenge_id = c.id;
        END IF;
      END LOOP;
    END IF;

    -- ── Step 2: winner-takes-all payout ─────────────────────────────────────
    --
    -- Ties split the pool evenly. If every participant is disqualified or
    -- dropped out, no payout is inserted and the app retains the prize pool.
    IF c.prize_pool > 0 THEN
      SELECT MAX(points) INTO top_points
      FROM challenge_participants
      WHERE challenge_id    = c.id
        AND is_disqualified = false
        AND dropped_out_at  IS NULL;

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

-- Reschedule (cron entry already exists from previous migration; unschedule
-- removes it so the updated function is picked up cleanly)
SELECT cron.unschedule(jobid)
FROM cron.job
WHERE jobname = 'process-completed-challenges';

SELECT cron.schedule(
  'process-completed-challenges',
  '*/30 * * * *',
  'SELECT process_completed_challenges()'
);


-- ── 2. monitor_savings_withdrawals ───────────────────────────────────────────
--
-- Nightly sweep at 2 am. For every participant in an active challenge that
-- contains savings tasks, checks bank_transactions for any settled debit
-- above $15 since the challenge start date. Matches the $15 threshold used in
-- task-verification.ts and the Plaid webhook.
--
-- This is a safety net for the real-time webhook: if a Plaid sync was missed
-- (webhook outage, item re-linked after a gap), this job catches the
-- withdrawal before the challenge ends.

CREATE OR REPLACE FUNCTION monitor_savings_withdrawals()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  p RECORD;
BEGIN
  FOR p IN
    SELECT cp.user_id, cp.challenge_id, c.start_date
    FROM challenge_participants cp
    JOIN challenges c ON c.id = cp.challenge_id
    WHERE c.status          = 'active'
      AND cp.is_disqualified = false
      AND cp.dropped_out_at  IS NULL
      -- Challenge has at least one savings task
      AND EXISTS (
        SELECT 1 FROM tasks t
        WHERE t.challenge_id = c.id
          AND t.task_type    = 'savings'
      )
      -- User has a linked Plaid account (otherwise no transaction data exists)
      AND EXISTS (
        SELECT 1 FROM plaid_items pi
        WHERE pi.user_id = cp.user_id
      )
  LOOP
    IF EXISTS (
      SELECT 1
      FROM bank_transactions bt
      WHERE bt.user_id  = p.user_id
        AND bt.date     >= p.start_date::date
        AND bt.amount   > 15
        AND bt.pending  = false
    ) THEN
      UPDATE challenge_participants
      SET is_disqualified         = true,
          disqualification_reason = 'Withdrawal detected from linked savings account'
      WHERE user_id      = p.user_id
        AND challenge_id = p.challenge_id;
    END IF;
  END LOOP;
END;
$$;

SELECT cron.unschedule(jobid)
FROM cron.job
WHERE jobname = 'monitor-savings-withdrawals';

SELECT cron.schedule(
  'monitor-savings-withdrawals',
  '0 2 * * *',
  'SELECT monitor_savings_withdrawals()'
);
