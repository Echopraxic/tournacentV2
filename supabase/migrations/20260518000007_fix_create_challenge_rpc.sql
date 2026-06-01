/*
  Fix create_challenge_from_preset: the previous version inserted preset_id,
  but the challenges table has no such column (the insert failed at runtime).
  This forward migration replaces the function without preset_id. The function
  still accepts p_preset_id for forward-compatibility but does not store it.
*/

CREATE OR REPLACE FUNCTION create_challenge_from_preset(
  p_name           text,
  p_buy_in         numeric,
  p_duration_days  integer,
  p_challenge_type text,
  p_preset_id      text,
  p_tasks          jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_cid  uuid;
  v_code text := NULL;
  v_now  timestamptz := now();
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF p_challenge_type NOT IN ('solo', 'group') THEN
    RAISE EXCEPTION 'Invalid challenge type';
  END IF;

  -- Serialize concurrent creations for this user → atomic active-challenge check.
  PERFORM pg_advisory_xact_lock(hashtext(v_user::text));

  IF EXISTS (
    SELECT 1
    FROM challenge_participants cp
    JOIN challenges c ON c.id = cp.challenge_id
    WHERE cp.user_id = v_user
      AND cp.dropped_out_at IS NULL
      AND c.status IN ('pending', 'active')
  ) THEN
    RAISE EXCEPTION 'ALREADY_IN_CHALLENGE';
  END IF;

  IF p_challenge_type = 'solo' THEN
    INSERT INTO challenges (
      name, organizer_id, buy_in_amount, duration_days,
      start_date, end_date, status, challenge_type, prize_pool, is_template
    ) VALUES (
      p_name, v_user, p_buy_in, p_duration_days,
      v_now, v_now + make_interval(days => p_duration_days),
      'active', 'solo', 0, false
    ) RETURNING id INTO v_cid;
  ELSE
    v_code := generate_invite_code();
    INSERT INTO challenges (
      name, organizer_id, buy_in_amount, duration_days,
      status, challenge_type, invite_code, pending_expires_at, prize_pool, is_template
    ) VALUES (
      p_name, v_user, p_buy_in, p_duration_days,
      'pending', 'group', v_code, v_now + interval '48 hours', 0, false
    ) RETURNING id INTO v_cid;
  END IF;

  INSERT INTO tasks (challenge_id, title, description, points, task_type, verification_type, is_mandatory, form_id)
  SELECT v_cid,
         t->>'title',
         t->>'description',
         (t->>'points')::int,
         t->>'task_type',
         t->>'verification_type',
         COALESCE((t->>'is_mandatory')::boolean, false),
         t->>'form_id'
  FROM jsonb_array_elements(p_tasks) AS t;

  INSERT INTO challenge_participants (challenge_id, user_id, payment_status)
  VALUES (v_cid, v_user, CASE WHEN p_challenge_type = 'solo' THEN 'paid' ELSE 'pending' END);

  RETURN jsonb_build_object('challenge_id', v_cid, 'invite_code', v_code);
END;
$$;
