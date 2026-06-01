/*
  Server-side profile creation on signup.

  Problem this fixes:
  With email confirmation enabled, supabase.auth.signUp() returns no session,
  so the client stays in the `anon` role. The old client-side INSERT into
  profiles then failed the "authenticated"-only RLS policy, leaving an auth
  user with no profile and surfacing an RLS error to every new signup.

  This trigger creates the profile from the signup metadata as the table owner
  (SECURITY DEFINER), so it works regardless of whether a session exists yet.
  display_name / date_of_birth are passed via auth user metadata (options.data).

  The 13+ CHECK on profiles.date_of_birth remains a backstop: an underage DOB
  raises here and rolls back the auth user, so no underage account can exist.
*/

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, date_of_birth)
  VALUES (
    NEW.id,
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'display_name', ''), 'Player'),
    NULLIF(NEW.raw_user_meta_data->>'date_of_birth', '')::date
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
