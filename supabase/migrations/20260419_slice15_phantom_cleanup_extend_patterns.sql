-- Slice 1.5 — extend phantom-cleanup guard to cover the legacy
-- @whatsapp.decode.local synthetic-email pattern in addition to
-- wa_*@auth.internal. Runs the cleanup once to remove the three
-- known orphan rows discovered during Path B implementation
-- (auth.users with non-deterministic timestamped emails created
-- by pre-Slice-1 code, none of which have a model_profiles link).

CREATE OR REPLACE FUNCTION public.cleanup_phantom_auth_users()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_count integer;
BEGIN
  DELETE FROM auth.users
  WHERE (email LIKE 'wa\_%@auth.internal' ESCAPE '\'
         OR email LIKE '%@whatsapp.decode.local')
    AND id NOT IN (SELECT user_id FROM public.model_profiles);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$func$;

REVOKE ALL ON FUNCTION public.cleanup_phantom_auth_users() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cleanup_phantom_auth_users() TO service_role;

-- One-off invocation to clear current orphans.
SELECT public.cleanup_phantom_auth_users() AS phantoms_deleted;
