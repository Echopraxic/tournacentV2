/*
  Server-authoritative scoring — part 2 of 2 (the lockdown).

  Closes the exploit where a client could (a) insert arbitrary task_completions
  with no verification and (b) set challenge_participants.points to any value —
  both of which determined who won the real-money pot.

  After this:
  - task_completions can only be inserted by service_role (the complete-task
    edge function, which verifies eligibility server-side). The points trigger
    derives the score from those rows.
  - The client can no longer write points / rank / disqualification on
    challenge_participants. The only column it still needs to update directly is
    dropped_out_at (rejoin a pending group challenge), which is granted back.

  Privileged server paths are unaffected: the points trigger and verification run
  as SECURITY DEFINER / service_role, and edge functions use the service role.
*/

-- (a) Only the verified server path may record completions.
REVOKE INSERT ON task_completions FROM authenticated;

-- (b) Strip the client's table-wide UPDATE on participation, then grant back the
--     single column it legitimately needs. points/rank/is_disqualified are now
--     server-only (trigger + complete-task).
REVOKE UPDATE ON challenge_participants FROM authenticated;
GRANT  UPDATE (dropped_out_at) ON challenge_participants TO authenticated;
