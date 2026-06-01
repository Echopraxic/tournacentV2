/*
  Remove the dead/broken pg_net call from process_completed_challenges.

  The function tried to invoke payout-winner via extensions.http_post using
  current_setting('app.supabase_url') / current_setting('app.service_role_key').
  Those settings require superuser to configure (ALTER DATABASE) and are unset on
  Supabase, so the URL resolved to NULL and the call failed (silently, async).

  Payouts are actually triggered by the Database Webhook
  "trigger-payout-on-challenge-complete", which fires when the row below is
  updated to status='completed' and calls payout-winner with Supabase-managed
  service-role auth. That path works. This removes the broken duplicate so the
  money path no longer depends on unset settings (and can't abort the cron).

  Winner logic is unchanged: top points among non-disqualified, non-dropped
  participants; ties split the pool; payouts inserted as 'pending' for
  payout-winner to transfer via Stripe.
*/

CREATE OR REPLACE FUNCTION process_completed_challenges()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
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
          INSERT INTO transactions (user_id, challenge_id, amount, transaction_type, status)
          VALUES (w.user_id, c.id, payout, 'payout', 'pending');
        END LOOP;
      END IF;
    END IF;

    -- Marking the challenge completed fires the Database Webhook
    -- "trigger-payout-on-challenge-complete" → payout-winner edge function.
    UPDATE challenges SET status = 'completed' WHERE id = c.id;
  END LOOP;
END;
$function$;
