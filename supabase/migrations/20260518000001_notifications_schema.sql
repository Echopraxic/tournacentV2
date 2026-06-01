-- Push notification token storage
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS expo_push_token text;

-- Queue table: pg_cron jobs insert rows here; a Database Webhook fires
-- send-notification for each INSERT, then the function deletes the row.
CREATE TABLE IF NOT EXISTS notification_queue (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text        NOT NULL,
  payload    jsonb       NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE notification_queue ENABLE ROW LEVEL SECURITY;
-- Only service role may read/write; no user-facing policies needed.

-- ── pg_cron: 24-hour challenge ending warning ────────────────────────────────
-- Runs every hour. Finds active challenges ending in the next 23–25 hours
-- (window prevents double-insertion if the job runs a few minutes late).
SELECT cron.schedule(
  'challenge-ending-warning',
  '0 * * * *',
  $$
    INSERT INTO notification_queue (event_type, payload)
    SELECT 'challenge_ending_soon',
           jsonb_build_object('challenge_id', id)
    FROM   challenges
    WHERE  status   = 'active'
      AND  end_date BETWEEN now() + interval '23 hours'
                        AND now() + interval '25 hours';
  $$
);

-- ── pg_cron: buy-in deadline reminder ────────────────────────────────────────
-- Runs every 30 minutes. Finds active group challenges whose buy-in deadline
-- is 1.5–2.5 hours away and still have pending participants.
SELECT cron.schedule(
  'buyin-deadline-reminder',
  '*/30 * * * *',
  $$
    INSERT INTO notification_queue (event_type, payload)
    SELECT DISTINCT 'buyin_deadline_soon',
           jsonb_build_object('challenge_id', c.id)
    FROM   challenges c
    JOIN   challenge_participants cp
           ON cp.challenge_id    = c.id
           AND cp.payment_status = 'pending'
           AND cp.dropped_out_at IS NULL
    WHERE  c.status          = 'active'
      AND  c.challenge_type  = 'group'
      AND  c.buyin_deadline  BETWEEN now() + interval '90 minutes'
                                 AND now() + interval '150 minutes';
  $$
);
