/*
  # Fix challenges RLS — allow browsing active challenges

  Previously users could only see challenges they had already joined.
  This adds a policy so any authenticated user can view active challenges,
  enabling the Browse Challenges screen to work before joining.
*/

CREATE POLICY "Anyone can view active challenges"
  ON challenges FOR SELECT
  TO authenticated
  USING (status = 'active');
