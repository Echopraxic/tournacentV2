/*
  # Solo / Group Challenge Support

  1. New columns on challenges
     - challenge_type: 'solo' | 'group'
     - is_template: marks the preset library entries shown in Browse
     - invite_code: human-readable TC-XXXX code for group challenges
     - pending_expires_at: 48 h window for group challenges to recruit 3 players
     - buyin_deadline: 48 h after activation for players to pay their buy-in
     - join_deadline: 48 h after activation for additional players to join

  2. Status extended to include 'pending' and 'cancelled'

  3. generate_invite_code() RPC – returns a unique TC-XXXX code

  4. get_challenge_by_invite_code(text) RPC – public (anon-safe) lookup so
     unauthenticated users following an invite link can preview the challenge

  5. activate_group_challenge trigger – auto-activates a pending group challenge
     the moment its 3rd participant joins

  6. RLS additions
     - templates are visible to all authenticated users
     - organizers can always see their own challenges
     - pending/active group challenges are discoverable via invite code
*/

-- ── 1. Schema changes ────────────────────────────────────────────────────────

ALTER TABLE challenges
  ADD COLUMN IF NOT EXISTS challenge_type   text        NOT NULL DEFAULT 'group'
      CHECK (challenge_type IN ('solo', 'group')),
  ADD COLUMN IF NOT EXISTS is_template      boolean     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS invite_code      text        UNIQUE,
  ADD COLUMN IF NOT EXISTS pending_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS buyin_deadline   timestamptz,
  ADD COLUMN IF NOT EXISTS join_deadline    timestamptz;

-- Extend status to include pending and cancelled
ALTER TABLE challenges DROP CONSTRAINT IF EXISTS challenges_status_check;
ALTER TABLE challenges ADD CONSTRAINT challenges_status_check
  CHECK (status IN ('draft', 'pending', 'active', 'completed', 'cancelled'));

-- Mark all existing preset challenges as browse-library templates
UPDATE challenges SET is_template = true WHERE is_template = false;

-- ── 2. generate_invite_code() ────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION generate_invite_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  -- Omit ambiguous characters (0/O, 1/I/L)
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code  text;
BEGIN
  LOOP
    code := 'TC-'
      || substr(chars, floor(random() * 32 + 1)::int, 1)
      || substr(chars, floor(random() * 32 + 1)::int, 1)
      || substr(chars, floor(random() * 32 + 1)::int, 1)
      || substr(chars, floor(random() * 32 + 1)::int, 1);
    EXIT WHEN NOT EXISTS (SELECT 1 FROM challenges WHERE invite_code = code);
  END LOOP;
  RETURN code;
END;
$$;

GRANT EXECUTE ON FUNCTION generate_invite_code() TO authenticated;

-- ── 3. get_challenge_by_invite_code() – accessible to anon ──────────────────

CREATE OR REPLACE FUNCTION get_challenge_by_invite_code(code text)
RETURNS TABLE (
  id                  uuid,
  name                text,
  duration_days       integer,
  buy_in_amount       numeric,
  status              text,
  challenge_type      text,
  invite_code         text,
  pending_expires_at  timestamptz,
  buyin_deadline      timestamptz,
  join_deadline       timestamptz
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT
    id, name, duration_days, buy_in_amount, status, challenge_type,
    invite_code, pending_expires_at, buyin_deadline, join_deadline
  FROM challenges
  WHERE challenges.invite_code = code
    AND status IN ('pending', 'active');
$$;

GRANT EXECUTE ON FUNCTION get_challenge_by_invite_code(text) TO anon, authenticated;

-- ── 4. Auto-activation trigger ───────────────────────────────────────────────

CREATE OR REPLACE FUNCTION activate_group_challenge()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  p_count    int;
  c_type     text;
  c_status   text;
  c_duration int;
BEGIN
  SELECT challenge_type, status, duration_days
  INTO   c_type, c_status, c_duration
  FROM   challenges
  WHERE  id = NEW.challenge_id;

  IF c_type = 'group' AND c_status = 'pending' THEN
    SELECT COUNT(*) INTO p_count
    FROM   challenge_participants
    WHERE  challenge_id = NEW.challenge_id;

    IF p_count >= 3 THEN
      UPDATE challenges SET
        status        = 'active',
        start_date    = now(),
        end_date      = now() + (c_duration || ' days')::interval,
        buyin_deadline = now() + interval '48 hours',
        join_deadline  = now() + interval '48 hours'
      WHERE id = NEW.challenge_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_participant_joined ON challenge_participants;
CREATE TRIGGER on_participant_joined
  AFTER INSERT ON challenge_participants
  FOR EACH ROW EXECUTE FUNCTION activate_group_challenge();

-- ── 5. RLS additions ─────────────────────────────────────────────────────────

-- Templates are visible to all authenticated users for browsing
CREATE POLICY "Users can view challenge templates"
  ON challenges FOR SELECT
  TO authenticated
  USING (is_template = true);

-- Organizers can always see their own challenges (pending, active, etc.)
CREATE POLICY "Organizers can view own challenges"
  ON challenges FOR SELECT
  TO authenticated
  USING (organizer_id = auth.uid());

-- Any authenticated user can look up a group challenge by its invite code
CREATE POLICY "Users can view group challenges by invite code"
  ON challenges FOR SELECT
  TO authenticated
  USING (invite_code IS NOT NULL AND status IN ('pending', 'active'));
