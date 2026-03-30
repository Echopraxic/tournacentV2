/*
  # Tournacent Database Schema

  ## Overview
  Complete database schema for Tournacent - a financial literacy challenge app where friends compete
  in groups by completing tasks to win a pooled prize.

  ## Tables Created

  1. **profiles**
     - id (uuid, references auth.users)
     - display_name (text)
     - avatar_url (text, optional)
     - created_at (timestamptz)
     
  2. **challenges**
     - id (uuid, primary key)
     - name (text)
     - organizer_id (uuid, references profiles)
     - buy_in_amount (numeric)
     - duration_days (integer, 7 or 14)
     - start_date (timestamptz)
     - end_date (timestamptz)
     - status (text: draft, active, completed)
     - prize_pool (numeric)
     - created_at (timestamptz)
     
  3. **challenge_participants**
     - id (uuid, primary key)
     - challenge_id (uuid, references challenges)
     - user_id (uuid, references profiles)
     - points (integer, default 0)
     - is_disqualified (boolean, default false)
     - disqualification_reason (text, optional)
     - payment_status (text: pending, paid, refunded)
     - rank (integer, nullable)
     - joined_at (timestamptz)
     
  4. **tasks**
     - id (uuid, primary key)
     - challenge_id (uuid, references challenges)
     - title (text)
     - description (text)
     - points (integer)
     - is_mandatory (boolean, default false)
     - task_type (text: budget, tracking, cooking, subscription, reading, savings, custom)
     - created_at (timestamptz)
     
  5. **task_completions**
     - id (uuid, primary key)
     - task_id (uuid, references tasks)
     - user_id (uuid, references profiles)
     - challenge_id (uuid, references challenges)
     - completed_at (timestamptz)
     
  6. **transactions**
     - id (uuid, primary key)
     - user_id (uuid, references profiles)
     - challenge_id (uuid, references challenges)
     - amount (numeric)
     - transaction_type (text: buy_in, payout, refund)
     - status (text: pending, verified, in_progress, denied)
     - denial_reason (text, optional)
     - created_at (timestamptz)

  ## Security
  - RLS enabled on all tables
  - Users can view their own profile and profiles of challenge participants
  - Challenge participants can view challenge details and tasks
  - Only challenge creators can modify challenge settings
  - Users can complete their own tasks
  - Users can view their own transactions
*/

-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  display_name text NOT NULL,
  avatar_url text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Create challenges table
CREATE TABLE IF NOT EXISTS challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  organizer_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  buy_in_amount numeric NOT NULL CHECK (buy_in_amount >= 1 AND buy_in_amount <= 50),
  duration_days integer NOT NULL CHECK (duration_days IN (7, 14)),
  start_date timestamptz,
  end_date timestamptz,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'completed')),
  prize_pool numeric DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE challenges ENABLE ROW LEVEL SECURITY;

-- Create challenge_participants table
CREATE TABLE IF NOT EXISTS challenge_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id uuid NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  points integer DEFAULT 0,
  is_disqualified boolean DEFAULT false,
  disqualification_reason text,
  payment_status text NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'refunded')),
  rank integer,
  joined_at timestamptz DEFAULT now(),
  UNIQUE(challenge_id, user_id)
);

ALTER TABLE challenge_participants ENABLE ROW LEVEL SECURITY;

-- Now add RLS policies for challenges (after challenge_participants exists)
CREATE POLICY "Challenge participants can view challenges"
  ON challenges FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM challenge_participants
      WHERE challenge_participants.challenge_id = challenges.id
      AND challenge_participants.user_id = auth.uid()
    )
  );

CREATE POLICY "Challenge organizers can update challenges"
  ON challenges FOR UPDATE
  TO authenticated
  USING (organizer_id = auth.uid())
  WITH CHECK (organizer_id = auth.uid());

CREATE POLICY "Authenticated users can create challenges"
  ON challenges FOR INSERT
  TO authenticated
  WITH CHECK (organizer_id = auth.uid());

-- Add RLS policies for challenge_participants
CREATE POLICY "Participants can view challenge participants"
  ON challenge_participants FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM challenge_participants cp
      WHERE cp.challenge_id = challenge_participants.challenge_id
      AND cp.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can join challenges"
  ON challenge_participants FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own participation"
  ON challenge_participants FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Create tasks table
CREATE TABLE IF NOT EXISTS tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id uuid NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL,
  points integer NOT NULL CHECK (points > 0),
  is_mandatory boolean DEFAULT false,
  task_type text NOT NULL CHECK (task_type IN ('budget', 'tracking', 'cooking', 'subscription', 'reading', 'savings', 'custom')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Challenge participants can view tasks"
  ON tasks FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM challenge_participants
      WHERE challenge_participants.challenge_id = tasks.challenge_id
      AND challenge_participants.user_id = auth.uid()
    )
  );

CREATE POLICY "Challenge organizers can create tasks"
  ON tasks FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM challenges
      WHERE challenges.id = tasks.challenge_id
      AND challenges.organizer_id = auth.uid()
    )
  );

-- Create task_completions table
CREATE TABLE IF NOT EXISTS task_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  challenge_id uuid NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  completed_at timestamptz DEFAULT now(),
  UNIQUE(task_id, user_id)
);

ALTER TABLE task_completions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own task completions"
  ON task_completions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM challenge_participants
      WHERE challenge_participants.challenge_id = task_completions.challenge_id
      AND challenge_participants.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can complete own tasks"
  ON task_completions FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Create transactions table
CREATE TABLE IF NOT EXISTS transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  challenge_id uuid NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  transaction_type text NOT NULL CHECK (transaction_type IN ('buy_in', 'payout', 'refund')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'in_progress', 'denied')),
  denial_reason text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own transactions"
  ON transactions FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "System can create transactions"
  ON transactions FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_challenge_participants_challenge_id ON challenge_participants(challenge_id);
CREATE INDEX IF NOT EXISTS idx_challenge_participants_user_id ON challenge_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_challenge_id ON tasks(challenge_id);
CREATE INDEX IF NOT EXISTS idx_task_completions_task_id ON task_completions(task_id);
CREATE INDEX IF NOT EXISTS idx_task_completions_user_id ON task_completions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_challenge_id ON transactions(challenge_id);
