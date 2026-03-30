/*
  # Fix template preset challenges

  The previous preset migration skipped creation when no profiles existed,
  causing Browse Challenges to be empty for all users.

  Fix:
  1. Allow organizer_id to be NULL on challenge templates
  2. Re-seed preset challenges without requiring a real profile
*/

-- Allow NULL organizer for template challenges
ALTER TABLE challenges ALTER COLUMN organizer_id DROP NOT NULL;

-- Remove any broken/incomplete presets
DELETE FROM challenges WHERE is_template = true;

-- Re-create preset challenges with no organizer dependency
INSERT INTO challenges (
  name, organizer_id, buy_in_amount, duration_days,
  start_date, end_date, status, prize_pool, is_template, challenge_type
) VALUES
  ('30-Day Emergency Fund Sprint', NULL, 17.50, 30,
   now(), now() + interval '30 days', 'active', 0, true, 'group'),
  ('No-Spend Reset Challenge', NULL, 15.00, 21,
   now(), now() + interval '21 days', 'active', 0, true, 'group');

-- Seed tasks for Emergency Fund Sprint
DO $$
DECLARE
  ef_id uuid;
  ns_id uuid;
BEGIN
  SELECT id INTO ef_id FROM challenges WHERE name = '30-Day Emergency Fund Sprint' AND is_template = true;
  SELECT id INTO ns_id FROM challenges WHERE name = 'No-Spend Reset Challenge' AND is_template = true;

  INSERT INTO tasks (challenge_id, title, description, points, is_mandatory, task_type) VALUES
    (ef_id, 'Connect Savings Account', 'Link your savings account to the app', 20, true, 'savings'),
    (ef_id, 'Set Emergency Fund Goal', 'Set your emergency fund target amount in the app', 10, true, 'savings'),
    (ef_id, 'Deposit at Least $25', 'Make your first deposit of $25 or more', 20, true, 'savings'),
    (ef_id, 'Deposit at Least $100 Total', 'Reach a total deposit balance of $100', 40, true, 'savings'),
    (ef_id, 'Deposit at Least $250 Total', 'Reach a total deposit balance of $250', 60, true, 'savings'),
    (ef_id, '7-Day Expense Tracking Streak', 'Log your expenses every day for 7 consecutive days', 30, false, 'tracking'),
    (ef_id, 'Cancel One Subscription', 'Identify and cancel at least one unused subscription service', 25, false, 'subscription'),
    (ef_id, 'Automate Weekly Transfer', 'Set up automatic weekly transfers to your savings account', 40, false, 'savings'),
    (ef_id, 'Watch Savings Fundamentals Lesson', 'Complete a personal finance education module', 20, false, 'reading'),
    (ef_id, '14-Day No-Impulse-Buy Streak', 'Avoid impulse purchases over $20 for 14 consecutive days', 35, false, 'no_spend');

  INSERT INTO tasks (challenge_id, title, description, points, is_mandatory, task_type) VALUES
    (ns_id, 'Declare 3 Spending Categories to Avoid', 'Choose 3 categories you will not purchase from during the challenge', 20, true, 'no_spend'),
    (ns_id, '7-Day No-Spend Streak', 'Complete 7 consecutive days with zero spending in your target categories', 40, true, 'no_spend'),
    (ns_id, '14-Day No-Spend Streak', 'Complete 14 consecutive days with zero spending in target categories', 60, true, 'no_spend'),
    (ns_id, 'Cook at Home 10 Times', 'Prepare meals at home instead of ordering delivery or eating out', 30, false, 'cooking'),
    (ns_id, 'Replace Purchase with Free Alternative', 'Find a free alternative to a purchase you normally make', 25, false, 'no_spend'),
    (ns_id, 'Track Every Purchase for 21 Days', 'Log all spending entries throughout the entire challenge', 40, false, 'tracking'),
    (ns_id, 'Save at Least $150 During Challenge', 'Reduce spending enough to save $150 or more', 35, false, 'savings');
END $$;
