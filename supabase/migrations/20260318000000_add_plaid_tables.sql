/*
  # Add Plaid Integration Tables

  ## Tables Created

  1. **plaid_items**
     - Stores Plaid access tokens per user (one per user)
     - Links user to their connected bank institution

  2. **bank_transactions**
     - Stores synced bank transactions fetched via Plaid
     - Used for anti-gaming verification (deposit tracking, no-spend monitoring)

  ## Security
  - RLS enabled on both tables
  - Users can only access their own data
*/

-- Plaid items: one linked bank account per user
CREATE TABLE IF NOT EXISTS plaid_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  access_token text NOT NULL,
  item_id text NOT NULL,
  institution_name text,
  institution_id text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

-- Bank transactions synced from Plaid
CREATE TABLE IF NOT EXISTS bank_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  plaid_transaction_id text UNIQUE NOT NULL,
  account_id text NOT NULL,
  -- In Plaid: positive = debit (money out), negative = credit (money in)
  amount numeric NOT NULL,
  date date NOT NULL,
  name text NOT NULL,
  category text[] DEFAULT '{}',
  pending boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS bank_transactions_user_id_date_idx
  ON bank_transactions(user_id, date DESC);

CREATE INDEX IF NOT EXISTS bank_transactions_user_id_amount_idx
  ON bank_transactions(user_id, amount);

-- Enable RLS
ALTER TABLE plaid_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for plaid_items
CREATE POLICY "Users can view own plaid items"
  ON plaid_items FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own plaid items"
  ON plaid_items FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own plaid items"
  ON plaid_items FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policies for bank_transactions
--
-- ASSUMPTION: Each user has exactly ONE linked bank account at a time.
-- This is enforced by UNIQUE(user_id) on plaid_items. Because of that
-- single-account invariant, checking user_id is sufficient to isolate rows —
-- there is no need to add challenge_id to these policies.
--
-- ⚠️  If multi-account support is ever introduced (removing the UNIQUE
--     constraint on plaid_items.user_id), these policies MUST be updated
--     to include challenge_id context so transactions from different linked
--     accounts are not exposed across challenge groups.
CREATE POLICY "Users can view own bank transactions"
  ON bank_transactions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own bank transactions"
  ON bank_transactions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can upsert own bank transactions"
  ON bank_transactions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);
