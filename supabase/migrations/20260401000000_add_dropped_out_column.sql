/*
  # Add dropped_out_at to challenge_participants

  Replaces hard-delete dropout with a soft-delete pattern:
  - dropped_out_at: timestamptz — set when a user voluntarily leaves a challenge
  - Null means active participant; non-null means dropped out
  - Prevents re-joining after dropout (join screen checks this column)
  - Keeps audit trail and allows dropped-out participants to appear on leaderboard
*/

ALTER TABLE challenge_participants
  ADD COLUMN IF NOT EXISTS dropped_out_at timestamptz;

-- Index for fast "active participants only" queries
CREATE INDEX IF NOT EXISTS challenge_participants_dropped_out_at
  ON challenge_participants (dropped_out_at)
  WHERE dropped_out_at IS NULL;
