/*
  Updates process_completed_challenges to insert payout transactions with
  status='pending'. The payout-winner edge function is triggered automatically
  by a Supabase Database Webhook (configured in Dashboard — see manual steps).

  The Database Webhook approach is preferred over pg_net because:
  - No ALTER DATABASE superuser permission required
  - Supabase handles the service role auth header automatically
  - Cleaner separation of DB and HTTP concerns
*/

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
          -- Insert with status='pending'; Database Webhook fires payout-winner
          -- which executes the Stripe Transfer and marks status='verified'.
          INSERT INTO transactions (user_id, challenge_id, amount, transaction_type, status)
          VALUES (w.user_id, c.id, payout, 'payout', 'pending');
        END LOOP;
      END IF;
    END IF;

    -- Updating status to 'completed' triggers the Database Webhook
    UPDATE challenges SET status = 'completed' WHERE id = c.id;
  END LOOP;
END;
$$;
