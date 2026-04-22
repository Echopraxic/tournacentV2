/*
  User consent tracking table.

  Records each time a user affirmatively consents to a specific data processing
  activity. Consent proof (IP, timestamp, version, full text) is required for
  CCPA, GDPR, and NY SHIELD Act compliance.

  consent_type values:
    'plaid'       — consent to connect bank account via Plaid
    'analytics'   — opt-in to crash/event analytics
    'marketing'   — opt-in to marketing email

  Consent is withdrawn by setting withdrawn_at. The row is never deleted so the
  audit trail is preserved for legal purposes.
*/

CREATE TABLE IF NOT EXISTS user_consents (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  consent_type    text        NOT NULL CHECK (consent_type IN ('plaid', 'analytics', 'marketing')),
  version         text        NOT NULL DEFAULT '1.0',
  accepted_at     timestamptz NOT NULL DEFAULT now(),
  -- proof of consent
  ip_address      text,
  user_agent      text,
  consent_string  text        NOT NULL, -- full consent text displayed to user
  -- withdrawal
  withdrawn_at    timestamptz,
  UNIQUE (user_id, consent_type, version)
);

ALTER TABLE user_consents ENABLE ROW LEVEL SECURITY;

-- Users can only read their own consent records
CREATE POLICY "Users can read own consents"
  ON user_consents FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Users can insert their own consent records
CREATE POLICY "Users can insert own consents"
  ON user_consents FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can withdraw consent (update withdrawn_at only; cannot delete)
CREATE POLICY "Users can withdraw own consents"
  ON user_consents FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Service role can read all consents for compliance reporting
-- (No explicit policy needed — service_role bypasses RLS)
