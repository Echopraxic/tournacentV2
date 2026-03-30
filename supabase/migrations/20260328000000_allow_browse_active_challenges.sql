/*
  # Allow browsing active challenges

  The existing RLS policy on challenges only permits users to SELECT challenges
  they are already participating in. This prevents new users from discovering
  and joining any challenges. This migration adds a separate policy that lets
  any authenticated user read challenges with status = 'active'.
*/

CREATE POLICY "Authenticated users can view active challenges"
  ON challenges FOR SELECT
  TO authenticated
  USING (status = 'active');
