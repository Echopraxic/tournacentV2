/*
  # Debt account support

  1. plaid_items — add item_type ('savings' | 'debt'), replace the single
     per-user unique constraint with per-user-per-type so one savings and
     one debt account can coexist.

  2. bank_transactions — add item_type so debt and savings transactions can
     be queried separately.

  3. plaid_accounts — new table. Stores per-account balance data refreshed
     by the webhook after every sync. Used by verifyDebtPaymentTask to check
     whether a credit card balance has reached $0.
*/

-- ── plaid_items ──────────────────────────────────────────────────────────────

ALTER TABLE plaid_items
  ADD COLUMN IF NOT EXISTS item_type text NOT NULL DEFAULT 'savings';

-- Swap the single-user unique constraint for a per-user-per-type one.
-- The old constraint is named plaid_items_user_id_key by Postgres convention.
DO $$ BEGIN
  ALTER TABLE plaid_items DROP CONSTRAINT plaid_items_user_id_key;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

ALTER TABLE plaid_items
  ADD CONSTRAINT plaid_items_user_item_type_key UNIQUE (user_id, item_type);

-- ── bank_transactions ────────────────────────────────────────────────────────

ALTER TABLE bank_transactions
  ADD COLUMN IF NOT EXISTS item_type text NOT NULL DEFAULT 'savings';

-- ── plaid_accounts ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS plaid_accounts (
  id               uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id          uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plaid_item_id    text        NOT NULL,
  account_id       text        NOT NULL,
  name             text,
  account_type     text,
  account_subtype  text,
  current_balance  numeric,
  available_balance numeric,
  updated_at       timestamptz DEFAULT now(),
  UNIQUE (account_id)
);

ALTER TABLE plaid_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own plaid accounts"
  ON plaid_accounts FOR SELECT
  USING (auth.uid() = user_id);
