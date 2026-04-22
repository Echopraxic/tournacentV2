/*
  Replaces drop_out_of_challenge() with refund logic.

  When a participant who has already paid (payment_status = 'paid') drops out
  of a group challenge while others remain, they are entitled to a refund of
  their buy-in. This migration adds that logic to the group-dropout branch:

    1. Insert a 'refund' transaction for the departing user.
    2. Set their payment_status = 'refunded'.
    3. Decrement the challenge prize_pool by the buy-in amount.

  The solo / last-person branch hard-deletes the challenge and all child rows
  (no refund row needed because the challenge record is gone).
*/

CREATE OR REPLACE FUNCTION drop_out_of_challenge(p_challenge_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id       uuid    := auth.uid();
  v_other_count   int;
  v_payment_status text;
  v_buy_in_amount numeric;
BEGIN
  -- Reject unauthenticated calls
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- Verify the caller is currently an active participant; capture their payment_status
  SELECT cp.payment_status
  INTO   v_payment_status
  FROM   challenge_participants cp
  WHERE  cp.challenge_id   = p_challenge_id
    AND  cp.user_id        = v_user_id
    AND  cp.dropped_out_at IS NULL;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error',   'You are not an active participant in this challenge'
    );
  END IF;

  -- Fetch buy-in amount for potential refund calculation
  SELECT buy_in_amount
  INTO   v_buy_in_amount
  FROM   challenges
  WHERE  id = p_challenge_id;

  -- Count other active participants
  SELECT COUNT(*)
  INTO   v_other_count
  FROM   challenge_participants
  WHERE  challenge_id   = p_challenge_id
    AND  user_id       <> v_user_id
    AND  dropped_out_at IS NULL;

  IF v_other_count = 0 THEN
    -- ── Solo / last person: hard-delete everything ──────────────────────────
    -- No refund row needed — the whole challenge is removed.
    DELETE FROM task_completions       WHERE challenge_id = p_challenge_id;
    DELETE FROM tasks                  WHERE challenge_id = p_challenge_id;
    DELETE FROM transactions           WHERE challenge_id = p_challenge_id;
    DELETE FROM challenge_participants WHERE challenge_id = p_challenge_id;
    DELETE FROM challenges             WHERE id           = p_challenge_id;

    RETURN jsonb_build_object('success', true, 'action', 'deleted');

  ELSE
    -- ── Group with others remaining: soft-delete + optional refund ──────────
    UPDATE challenge_participants
    SET    dropped_out_at = now()
    WHERE  challenge_id  = p_challenge_id
      AND  user_id       = v_user_id;

    -- Issue a refund transaction and adjust prize_pool only if the user paid
    IF v_payment_status = 'paid' THEN
      INSERT INTO transactions (user_id, challenge_id, amount, transaction_type, status)
      VALUES (v_user_id, p_challenge_id, v_buy_in_amount, 'refund', 'verified');

      UPDATE challenge_participants
      SET    payment_status = 'refunded'
      WHERE  challenge_id  = p_challenge_id
        AND  user_id       = v_user_id;

      -- Reduce prize pool so remaining participants are not inflated
      UPDATE challenges
      SET    prize_pool = GREATEST(0, prize_pool - v_buy_in_amount)
      WHERE  id = p_challenge_id;
    END IF;

    RETURN jsonb_build_object(
      'success', true,
      'action',  'dropped_out',
      'refunded', (v_payment_status = 'paid')
    );
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION drop_out_of_challenge(uuid) TO authenticated;
