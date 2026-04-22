/*
  Remove duplicate "view active challenges" SELECT policy on challenges.

  Two migrations independently created SELECT policies with identical
  USING (status = 'active') predicates:

    20260324000001  →  "Anyone can view active challenges"
    20260328000000  →  "Authenticated users can view active challenges"

  In PostgreSQL, permissive RLS policies are combined with OR, so two
  identical policies are functionally equivalent to one. The duplication
  creates confusion when inspecting policies and makes future audits harder.

  We keep "Authenticated users can view active challenges" (the more
  descriptive name) and drop the older redundant one.
*/

DROP POLICY IF EXISTS "Anyone can view active challenges" ON challenges;
