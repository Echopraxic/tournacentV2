-- Waitlist email capture for the Tournacent marketing site.
-- Anon users can insert their own email; nobody can read the list via the client.
CREATE TABLE waitlist_emails (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email      text NOT NULL,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT waitlist_emails_email_key UNIQUE (email),
  CONSTRAINT waitlist_emails_email_check CHECK (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$')
);

ALTER TABLE waitlist_emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_insert_email" ON waitlist_emails
  FOR INSERT TO anon
  WITH CHECK (true);
