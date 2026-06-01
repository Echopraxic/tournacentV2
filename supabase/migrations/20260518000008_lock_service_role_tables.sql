/*
  Lock down server-authoritative tables (critical).

  The RLS audit found that `authenticated` could INSERT into `transactions` and
  INSERT/UPDATE `bank_transactions` (and `plaid_items`). These are forgery holes
  for a real-money app:

    - transactions: a user could insert a `payout` row for themselves; when that
      challenge completes, payout-winner transfers it via Stripe → fraud.
    - bank_transactions: a user could fabricate deposits/payments to pass the
      Plaid-verified savings/no_spend/debt tasks that gate the prize pool.
    - plaid_items: holds the (encrypted) Plaid access token + sync cursor; only
      the exchange-token / sync functions should write it.

  The client never writes any of these directly (verified) — every write goes
  through a service-role edge function or SECURITY DEFINER RPC, which bypass RLS
  and keep their own privileges. So we revoke write access from `authenticated`.
  SELECT stays (wallet history, linked-account info).
*/

REVOKE INSERT          ON transactions      FROM authenticated;
REVOKE INSERT, UPDATE  ON bank_transactions FROM authenticated;
REVOKE INSERT, UPDATE  ON plaid_items       FROM authenticated;
