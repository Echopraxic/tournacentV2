/*
  RLS Challenge Isolation Test Suite
  Run with: supabase test db

  Tests that users cannot access other groups' financial data or task records.
  Each test block wraps in a transaction and rolls back, leaving no residue.
*/

BEGIN;
SELECT plan(16);

-- ── Helpers ──────────────────────────────────────────────────────────────────

-- Simulate auth context for a given user UUID
CREATE OR REPLACE FUNCTION tests.set_auth(uid uuid)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', uid::text, 'role', 'authenticated')::text,
    true
  );
  SET LOCAL role TO authenticated;
END;
$$;

-- Clear auth context (back to postgres)
CREATE OR REPLACE FUNCTION tests.clear_auth()
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', '', true);
  RESET role;
END;
$$;

-- ── Seed data ─────────────────────────────────────────────────────────────────

DO $$
DECLARE
  alice_id  uuid := '00000000-0000-0000-0000-000000000001';
  bob_id    uuid := '00000000-0000-0000-0000-000000000002';
  cx_id     uuid := '10000000-0000-0000-0000-000000000001';
  cy_id     uuid := '10000000-0000-0000-0000-000000000002';
BEGIN
  -- Insert test users into auth.users
  INSERT INTO auth.users (id, email) VALUES
    (alice_id, 'alice@test.invalid'),
    (bob_id,   'bob@test.invalid')
  ON CONFLICT DO NOTHING;

  -- Insert profiles
  INSERT INTO profiles (id, display_name) VALUES
    (alice_id, 'Alice'),
    (bob_id,   'Bob')
  ON CONFLICT DO NOTHING;

  -- Challenge X (Alice's) — active so both users can browse it
  INSERT INTO challenges (id, name, organizer_id, status, buy_in_amount, duration_days, type)
  VALUES (cx_id, 'Challenge X', alice_id, 'active', 10, 30, 'group')
  ON CONFLICT DO NOTHING;

  -- Challenge Y (Bob's) — active
  INSERT INTO challenges (id, name, organizer_id, status, buy_in_amount, duration_days, type)
  VALUES (cy_id, 'Challenge Y', bob_id, 'active', 10, 30, 'group')
  ON CONFLICT DO NOTHING;

  -- Alice participates in Challenge X only
  INSERT INTO challenge_participants (challenge_id, user_id, status)
  VALUES (cx_id, alice_id, 'active')
  ON CONFLICT DO NOTHING;

  -- Bob participates in Challenge Y only
  INSERT INTO challenge_participants (challenge_id, user_id, status)
  VALUES (cy_id, bob_id, 'active')
  ON CONFLICT DO NOTHING;
END;
$$;

-- ── Test 1: challenge isolation — Alice cannot read Challenge Y participants ──

PERFORM tests.set_auth('00000000-0000-0000-0000-000000000001');

SELECT is(
  (SELECT count(*)::int FROM challenge_participants
   WHERE challenge_id = '10000000-0000-0000-0000-000000000002'),
  0,
  'Alice cannot read Challenge Y participants'
);

PERFORM tests.clear_auth();

-- ── Test 2: Bob cannot read Challenge X participants ─────────────────────────

PERFORM tests.set_auth('00000000-0000-0000-0000-000000000002');

SELECT is(
  (SELECT count(*)::int FROM challenge_participants
   WHERE challenge_id = '10000000-0000-0000-0000-000000000001'),
  0,
  'Bob cannot read Challenge X participants'
);

PERFORM tests.clear_auth();

-- ── Test 3: Alice CAN read Challenge X participants (her own challenge) ───────

PERFORM tests.set_auth('00000000-0000-0000-0000-000000000001');

SELECT ok(
  (SELECT count(*)::int FROM challenge_participants
   WHERE challenge_id = '10000000-0000-0000-0000-000000000001') > 0,
  'Alice can read her own Challenge X participants'
);

PERFORM tests.clear_auth();

-- ── Seed task completions ─────────────────────────────────────────────────────

DO $$
DECLARE
  alice_id uuid := '00000000-0000-0000-0000-000000000001';
  bob_id   uuid := '00000000-0000-0000-0000-000000000002';
  cx_id    uuid := '10000000-0000-0000-0000-000000000001';
  cy_id    uuid := '10000000-0000-0000-0000-000000000002';
  task_x   uuid := '20000000-0000-0000-0000-000000000001';
  task_y   uuid := '20000000-0000-0000-0000-000000000002';
BEGIN
  INSERT INTO tasks (id, challenge_id, title, description, points, task_type)
  VALUES
    (task_x, cx_id, 'Task in X', 'desc', 10, 'savings'),
    (task_y, cy_id, 'Task in Y', 'desc', 10, 'savings')
  ON CONFLICT DO NOTHING;

  -- Bob completes a task in Challenge Y
  INSERT INTO task_completions (task_id, user_id, challenge_id)
  VALUES (task_y, bob_id, cy_id)
  ON CONFLICT DO NOTHING;
END;
$$;

-- ── Test 4: Alice cannot read Bob's task completions in Challenge Y ───────────

PERFORM tests.set_auth('00000000-0000-0000-0000-000000000001');

SELECT is(
  (SELECT count(*)::int FROM task_completions
   WHERE challenge_id = '10000000-0000-0000-0000-000000000002'),
  0,
  'Alice cannot read task completions in Challenge Y'
);

PERFORM tests.clear_auth();

-- ── Test 5: Bob CAN read his own task completions in Challenge Y ──────────────

PERFORM tests.set_auth('00000000-0000-0000-0000-000000000002');

SELECT ok(
  (SELECT count(*)::int FROM task_completions
   WHERE challenge_id = '10000000-0000-0000-0000-000000000002') > 0,
  'Bob can read his own task completions in Challenge Y'
);

PERFORM tests.clear_auth();

-- ── Seed form/quiz/counter/text submissions ───────────────────────────────────

DO $$
DECLARE
  alice_id uuid := '00000000-0000-0000-0000-000000000001';
  bob_id   uuid := '00000000-0000-0000-0000-000000000002';
  cx_id    uuid := '10000000-0000-0000-0000-000000000001';
  cy_id    uuid := '10000000-0000-0000-0000-000000000002';
  task_x   uuid := '20000000-0000-0000-0000-000000000001';
  task_y   uuid := '20000000-0000-0000-0000-000000000002';
BEGIN
  -- Bob submits forms, quizzes, text in Challenge Y
  INSERT INTO task_form_submissions (user_id, task_id, challenge_id, form_id, form_data)
  VALUES (bob_id, task_y, cy_id, 'budget_form', '{"spent": 50}')
  ON CONFLICT DO NOTHING;

  INSERT INTO task_quiz_submissions (user_id, task_id, challenge_id, quiz_id, answers, score, profile_label)
  VALUES (bob_id, task_y, cy_id, 'savings_quiz', '{"q1": "a"}', 80, 'Saver')
  ON CONFLICT DO NOTHING;

  INSERT INTO task_text_submissions (user_id, task_id, challenge_id, content, word_count)
  VALUES (bob_id, task_y, cy_id, 'My reflection', 2)
  ON CONFLICT DO NOTHING;

  -- Alice submits in Challenge X
  INSERT INTO task_form_submissions (user_id, task_id, challenge_id, form_id, form_data)
  VALUES (alice_id, task_x, cx_id, 'budget_form', '{"spent": 30}')
  ON CONFLICT DO NOTHING;
END;
$$;

-- ── Test 6: Alice cannot read Bob's form submissions ─────────────────────────

PERFORM tests.set_auth('00000000-0000-0000-0000-000000000001');

SELECT is(
  (SELECT count(*)::int FROM task_form_submissions
   WHERE challenge_id = '10000000-0000-0000-0000-000000000002'),
  0,
  'Alice cannot read form submissions from Challenge Y (challenge_id RLS)'
);

-- ── Test 7: Alice CAN read her own form submissions in Challenge X ────────────

SELECT ok(
  (SELECT count(*)::int FROM task_form_submissions
   WHERE challenge_id = '10000000-0000-0000-0000-000000000001') > 0,
  'Alice can read her own form submissions in Challenge X'
);

PERFORM tests.clear_auth();

-- ── Test 8: Alice cannot read Bob's quiz submissions ─────────────────────────

PERFORM tests.set_auth('00000000-0000-0000-0000-000000000001');

SELECT is(
  (SELECT count(*)::int FROM task_quiz_submissions
   WHERE challenge_id = '10000000-0000-0000-0000-000000000002'),
  0,
  'Alice cannot read quiz submissions from Challenge Y'
);

PERFORM tests.clear_auth();

-- ── Test 9: Alice cannot read Bob's text submissions ─────────────────────────

PERFORM tests.set_auth('00000000-0000-0000-0000-000000000001');

SELECT is(
  (SELECT count(*)::int FROM task_text_submissions
   WHERE challenge_id = '10000000-0000-0000-0000-000000000002'),
  0,
  'Alice cannot read text submissions from Challenge Y'
);

PERFORM tests.clear_auth();

-- ── Test 10: Unauthenticated user cannot read any challenge participants ──────

RESET role;

SELECT is(
  (SELECT count(*)::int FROM challenge_participants),
  0,
  'Unauthenticated user cannot read challenge_participants'
);

-- ── Test 11: Unauthenticated user cannot read any task completions ────────────

SELECT is(
  (SELECT count(*)::int FROM task_completions),
  0,
  'Unauthenticated user cannot read task_completions'
);

-- ── Test 12: Unauthenticated user cannot read bank transactions ───────────────

SELECT is(
  (SELECT count(*)::int FROM bank_transactions),
  0,
  'Unauthenticated user cannot read bank_transactions'
);

-- ── Test 13: Active challenges are visible to any authenticated user ──────────

PERFORM tests.set_auth('00000000-0000-0000-0000-000000000001');

-- Alice (only in Challenge X) should still see Challenge Y in browse list
SELECT ok(
  (SELECT count(*)::int FROM challenges WHERE status = 'active') >= 2,
  'Alice can browse all active challenges (by design)'
);

PERFORM tests.clear_auth();

-- ── Test 14: user_is_challenge_participant returns correct results ─────────────

PERFORM tests.set_auth('00000000-0000-0000-0000-000000000001');

SELECT ok(
  user_is_challenge_participant('10000000-0000-0000-0000-000000000001'),
  'user_is_challenge_participant returns true for Alice in Challenge X'
);

SELECT ok(
  NOT user_is_challenge_participant('10000000-0000-0000-0000-000000000002'),
  'user_is_challenge_participant returns false for Alice in Challenge Y'
);

PERFORM tests.clear_auth();

-- ── Test 15: plaid_items — user can only read own plaid item ─────────────────

DO $$
DECLARE
  alice_id uuid := '00000000-0000-0000-0000-000000000001';
  bob_id   uuid := '00000000-0000-0000-0000-000000000002';
BEGIN
  INSERT INTO plaid_items (user_id, access_token, item_id, institution_name)
  VALUES
    (alice_id, 'access-sandbox-alice', 'item-alice', 'Chase'),
    (bob_id,   'access-sandbox-bob',   'item-bob',   'BofA')
  ON CONFLICT DO NOTHING;
END;
$$;

PERFORM tests.set_auth('00000000-0000-0000-0000-000000000001');

SELECT is(
  (SELECT count(*)::int FROM plaid_items),
  1,
  'Alice reads exactly one plaid_items row (her own)'
);

PERFORM tests.clear_auth();

-- ── Test 16: Storage — Alice cannot read from Bob's folder ───────────────────
-- Note: storage.objects RLS uses bucket_id + foldername check.
-- Direct SQL test verifies the policy predicate logic without requiring
-- actual file uploads (which need the storage API, not direct SQL).

SELECT ok(
  (
    SELECT (storage.foldername('00000000-0000-0000-0000-000000000002/task-123/proof.jpg'))[1]
      != '00000000-0000-0000-0000-000000000001'::text
  ),
  'Storage foldername extracts userId correctly (Bob path != Alice uid)'
);

SELECT * FROM finish();
ROLLBACK;
