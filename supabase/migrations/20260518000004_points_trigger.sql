/*
  Server-authoritative scoring — part 1 of 2 (the safe, additive half).

  Points were previously written by the client (points = total + task.points),
  which — combined with the "update own participation" RLS policy — let a user
  set any score. This trigger makes points a pure function of real completion
  rows: whenever a task_completions row is inserted or deleted, the owner's
  points are recomputed as the SUM of their completed tasks' point values.

  Deploying this before the client rewire is harmless: the client's own points
  update computes the same value, so they agree. Part 2 (RLS lockdown) revokes
  the client's ability to write points / insert completions and ships only after
  the client is rewired to the complete-task function.
*/

CREATE OR REPLACE FUNCTION recalc_participant_points()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := COALESCE(NEW.user_id, OLD.user_id);
  v_challenge uuid := COALESCE(NEW.challenge_id, OLD.challenge_id);
BEGIN
  UPDATE challenge_participants cp
     SET points = COALESCE((
       SELECT SUM(t.points)
       FROM task_completions tc
       JOIN tasks t ON t.id = tc.task_id
       WHERE tc.user_id = v_user
         AND tc.challenge_id = v_challenge
     ), 0)
   WHERE cp.user_id = v_user
     AND cp.challenge_id = v_challenge;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_recalc_points ON task_completions;
CREATE TRIGGER trg_recalc_points
  AFTER INSERT OR DELETE ON task_completions
  FOR EACH ROW EXECUTE FUNCTION recalc_participant_points();
