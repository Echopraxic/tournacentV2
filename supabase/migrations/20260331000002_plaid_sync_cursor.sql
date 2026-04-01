/*
  # Add cursor and last_synced_at to plaid_items

  cursor        — Plaid /transactions/sync pagination cursor. Stored after each
                  sync so the next call fetches only the delta (added/modified/removed)
                  rather than re-pulling 90 days of transactions.

  last_synced_at — Timestamp of the most recent successful sync. Used to:
                   • Rate-limit manual sync requests (1-hour cooldown)
                   • Debounce webhook-triggered syncs (5-minute window)
*/

ALTER TABLE plaid_items ADD COLUMN IF NOT EXISTS cursor text;
ALTER TABLE plaid_items ADD COLUMN IF NOT EXISTS last_synced_at timestamptz;
