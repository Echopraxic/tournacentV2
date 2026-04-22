/*
  Restrict execute permission on the SECURITY DEFINER helper function.

  user_is_challenge_participant(uuid) is marked SECURITY DEFINER, meaning it
  runs with the privileges of the function owner (postgres/supabase_admin)
  instead of the caller. This is necessary to break RLS recursion on
  challenge_participants, but it also means any caller who can EXECUTE the
  function inherits those elevated query rights for its duration.

  By default PostgreSQL grants EXECUTE to PUBLIC (all roles, including anon).
  We revoke that and grant only to the `authenticated` role, so unauthenticated
  Supabase clients cannot invoke the function directly via RPC.

  Note: the function still works correctly inside RLS policies because the
  challenge_participants policy is already scoped TO authenticated.
*/

-- Remove default public execute grant
REVOKE EXECUTE ON FUNCTION user_is_challenge_participant(uuid) FROM PUBLIC;

-- Allow only authenticated users to call it (e.g. via RPC or RLS)
GRANT EXECUTE ON FUNCTION user_is_challenge_participant(uuid) TO authenticated;

-- service_role must retain access so Edge Functions can call it when needed
GRANT EXECUTE ON FUNCTION user_is_challenge_participant(uuid) TO service_role;
