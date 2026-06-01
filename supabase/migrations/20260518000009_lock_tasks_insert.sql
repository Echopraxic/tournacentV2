/*
  Tasks are now created exclusively by create_challenge_from_preset (SECURITY
  DEFINER). The leftover "organizer can insert tasks" RLS policy was an integrity
  hole: a group challenge's organizer could inject an arbitrary high-point
  self-report task after creation and complete it to win the prize pool.

  Revoke client INSERT — the definer RPC bypasses RLS and is unaffected. The
  SELECT policy (participants view the task list) stays.
*/

REVOKE INSERT ON tasks FROM authenticated;
