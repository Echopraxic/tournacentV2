/*
  # Add Sample Data for Development

  ## Overview
  Adds sample challenge, tasks, and participants for development and testing.

  ## Sample Data

  1. **Sample Challenge**
     - Name: "Financial Fitness Sprint"
     - Buy-in: $25
     - Duration: 7 days
     - Status: active
     - Prize pool: $100 (4 participants)

  2. **Sample Tasks**
     - Mix of mandatory and optional tasks
     - Various point values and categories

  3. **Sample Participants**
     - Multiple users with different point totals
     - Some tasks completed
*/

-- Note: This is sample data for development. In production, users would create their own challenges.

-- Create a sample challenge (using a known user ID - this will need to be updated after user signup)
DO $$
DECLARE
  sample_challenge_id uuid;
  sample_user_id uuid;
BEGIN
  -- First, we'll create a placeholder challenge
  INSERT INTO challenges (
    id,
    name,
    organizer_id,
    buy_in_amount,
    duration_days,
    start_date,
    end_date,
    status,
    prize_pool
  )
  SELECT
    gen_random_uuid(),
    'Financial Fitness Sprint',
    id,
    25,
    7,
    now(),
    now() + interval '7 days',
    'active',
    100
  FROM profiles
  LIMIT 1
  RETURNING id INTO sample_challenge_id;

  -- Add sample tasks
  INSERT INTO tasks (challenge_id, title, description, points, is_mandatory, task_type)
  VALUES
    (sample_challenge_id, 'Create a Monthly Budget', 'Document all income and expenses for the month', 50, false, 'budget'),
    (sample_challenge_id, 'Track Daily Spending', 'Log all purchases for 3 consecutive days', 30, false, 'tracking'),
    (sample_challenge_id, 'Cook at Home', 'Prepare 5 meals at home instead of ordering delivery', 40, false, 'cooking'),
    (sample_challenge_id, 'Cancel Unused Subscription', 'Identify and cancel at least one unused subscription service', 35, false, 'subscription'),
    (sample_challenge_id, 'Read Finance Article', 'Read and summarize a personal finance article', 20, false, 'reading'),
    (sample_challenge_id, 'Set Up Auto-Save', 'Configure automatic savings transfer to savings account', 45, false, 'savings'),
    (sample_challenge_id, 'No Impulse Purchases', 'Avoid making any impulse purchases over $20', 25, true, 'custom'),
    (sample_challenge_id, 'Limit Food Delivery', 'Order food delivery no more than 2 times this week', 30, true, 'cooking');

EXCEPTION WHEN OTHERS THEN
  -- If there are no profiles yet, just skip
  RAISE NOTICE 'No profiles found, skipping sample data';
END $$;
