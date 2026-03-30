/*
  # Fix constraints and re-create preset challenges

  1. Remove duration_days check constraint (challenges can have any duration)
  2. Add 'no_spend' to task_type allowed values
  3. Clean up broken preset challenges and re-insert them correctly
*/

-- Drop duration_days check constraint
ALTER TABLE challenges DROP CONSTRAINT IF EXISTS challenges_duration_days_check;

-- Replace task_type check to include no_spend
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_task_type_check;
ALTER TABLE tasks ADD CONSTRAINT tasks_task_type_check
  CHECK (task_type IN ('budget', 'tracking', 'cooking', 'subscription', 'reading', 'savings', 'custom', 'no_spend'));

-- Clean up any broken preset challenges from the previous migration attempt
DELETE FROM challenges WHERE name IN ('30-Day Emergency Fund Sprint', 'No-Spend Reset Challenge');

-- Re-create preset challenges
DO $$
DECLARE
  emergency_fund_id uuid;
  no_spend_id uuid;
  organizer_id uuid;
BEGIN
  SELECT id INTO organizer_id FROM profiles ORDER BY created_at ASC LIMIT 1;

  IF organizer_id IS NULL THEN
    RAISE NOTICE 'No profiles found, skipping preset challenge creation';
    RETURN;
  END IF;

  -- Emergency Fund Sprint (30 days)
  INSERT INTO challenges (
    name, organizer_id, buy_in_amount, duration_days,
    start_date, end_date, status, prize_pool, created_at
  ) VALUES (
    '30-Day Emergency Fund Sprint', organizer_id, 17.50, 30,
    now(), now() + interval '30 days', 'active', 0, now()
  ) RETURNING id INTO emergency_fund_id;

  INSERT INTO tasks (challenge_id, title, description, points, is_mandatory, task_type) VALUES
    (emergency_fund_id, 'Connect Savings Account', 'Link your savings account to the app', 20, true, 'savings'),
    (emergency_fund_id, 'Set Emergency Fund Goal', 'Set your emergency fund target amount in the app', 10, true, 'savings'),
    (emergency_fund_id, 'Deposit at Least $25', 'Make your first deposit of $25 or more', 20, true, 'savings'),
    (emergency_fund_id, 'Deposit at Least $100 Total', 'Reach a total deposit balance of $100', 40, true, 'savings'),
    (emergency_fund_id, 'Deposit at Least $250 Total', 'Reach a total deposit balance of $250', 60, true, 'savings'),
    (emergency_fund_id, '7-Day Expense Tracking Streak', 'Log your expenses every day for 7 consecutive days', 30, false, 'tracking'),
    (emergency_fund_id, 'Cancel One Subscription', 'Identify and cancel at least one unused subscription service', 25, false, 'subscription'),
    (emergency_fund_id, 'Automate Weekly Transfer', 'Set up automatic weekly transfers to your savings account', 40, false, 'savings'),
    (emergency_fund_id, 'Watch Savings Fundamentals Lesson', 'Complete a personal finance education module', 20, false, 'reading'),
    (emergency_fund_id, '14-Day No-Impulse-Buy Streak', 'Avoid impulse purchases over $20 for 14 consecutive days', 35, false, 'no_spend');

  -- No-Spend Reset Challenge (21 days)
  INSERT INTO challenges (
    name, organizer_id, buy_in_amount, duration_days,
    start_date, end_date, status, prize_pool, created_at
  ) VALUES (
    'No-Spend Reset Challenge', organizer_id, 15, 21,
    now(), now() + interval '21 days', 'active', 0, now()
  ) RETURNING id INTO no_spend_id;

  INSERT INTO tasks (challenge_id, title, description, points, is_mandatory, task_type) VALUES
    (no_spend_id, 'Declare 3 Spending Categories to Avoid', 'Choose 3 spending categories you will not purchase from during the challenge', 20, true, 'no_spend'),
    (no_spend_id, '7-Day No-Spend Streak', 'Complete 7 consecutive days with zero spending in your target categories', 40, true, 'no_spend'),
    (no_spend_id, '14-Day No-Spend Streak', 'Complete 14 consecutive days with zero spending in your target categories', 60, true, 'no_spend'),
    (no_spend_id, 'Cook at Home 10 Times', 'Prepare meals at home instead of ordering delivery or eating out', 30, false, 'cooking'),
    (no_spend_id, 'Replace Purchase with Free Alternative', 'Find a free alternative to a purchase you normally make', 25, false, 'no_spend'),
    (no_spend_id, 'Track Every Purchase for 21 Days', 'Log all spending entries throughout the entire challenge', 40, false, 'tracking'),
    (no_spend_id, 'Save at Least $150 During Challenge', 'Reduce spending enough to save $150 or more', 35, false, 'savings');

  RAISE NOTICE 'Created preset challenges: % and %', emergency_fund_id, no_spend_id;
END $$;
