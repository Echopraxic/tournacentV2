/*
  Atomic, idempotent buy-in recording for the Stripe webhook.

  Problem this fixes:
  Stripe delivers webhook events at-least-once. The previous stripe-webhook
  handler unconditionally ran `prize_pool = prize_pool + buy_in_amount` and
  inserted a buy_in transaction on every `payment_intent.succeeded` delivery.
  A duplicate delivery therefore double-counted the prize pool and created a
  duplicate transaction. Two concurrent payments also raced on the read-then-
  write prize_pool update (lost update).

  This function does the whole thing in one transaction:
    1. Marks the participant paid ONLY if not already paid (idempotency guard).
    2. If (and only if) that update changed a row, atomically increments the
       prize pool and records the buy_in transaction.
  Returns true when the payment was newly recorded, false if it was a duplicate.
*/

CREATE OR REPLACE FUNCTION record_buyin_payment(
  p_challenge_id uuid,
  p_user_id uuid
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated int;
  v_buy_in numeric;
BEGIN
  -- Atomically claim the buy-in: only the first delivery flips pending -> paid.
  UPDATE challenge_participants
     SET payment_status = 'paid'
   WHERE challenge_id = p_challenge_id
     AND user_id = p_user_id
     AND payment_status IS DISTINCT FROM 'paid';
  GET DIAGNOSTICS v_updated = ROW_COUNT;

  -- Already paid (duplicate webhook delivery) — do nothing further.
  IF v_updated = 0 THEN
    RETURN false;
  END IF;

  SELECT buy_in_amount INTO v_buy_in FROM challenges WHERE id = p_challenge_id;
  IF v_buy_in IS NULL THEN
    RAISE EXCEPTION 'challenge % not found', p_challenge_id;
  END IF;

  -- Atomic increment — no read-then-write race between concurrent payments.
  UPDATE challenges
     SET prize_pool = prize_pool + v_buy_in
   WHERE id = p_challenge_id;

  INSERT INTO transactions (user_id, challenge_id, amount, transaction_type, status)
  VALUES (p_user_id, p_challenge_id, v_buy_in, 'buy_in', 'verified');

  RETURN true;
END;
$$;

-- Only the service role (Stripe webhook) may record payments.
REVOKE EXECUTE ON FUNCTION record_buyin_payment(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION record_buyin_payment(uuid, uuid) TO service_role;
