/*
  Stripe integration schema additions.

  - profiles: stripe_account_id (Connect Express account), stripe_onboarding_complete
  - challenge_participants: stripe_payment_intent_id (tracks which PaymentIntent covers this buy-in)
  - transactions: stripe_transfer_id (populated after winner payout via Stripe Transfers API)
  - pg_net extension: lets pg_cron call the payout-winner edge function over HTTP
*/

-- Stripe Connect payout account per user
ALTER TABLE profiles
  ADD COLUMN stripe_account_id        text,
  ADD COLUMN stripe_onboarding_complete boolean NOT NULL DEFAULT false;

-- Track which Stripe PaymentIntent covers each buy-in
ALTER TABLE challenge_participants
  ADD COLUMN stripe_payment_intent_id text;

-- Record Stripe transfer ID on payout rows for reconciliation
ALTER TABLE transactions
  ADD COLUMN stripe_transfer_id text;

-- pg_net ships enabled on Supabase; make it available if it somehow isn't
CREATE EXTENSION IF NOT EXISTS pg_net SCHEMA extensions;
