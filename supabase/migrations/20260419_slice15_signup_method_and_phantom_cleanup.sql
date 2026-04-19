-- Slice 1.5 PHASE 5A: add signup_method to public.users, backfill from existing
-- auth.users email pattern, mark NOT NULL, then clean up the single phantom
-- auth.users row left over from the Slice 1 synthetic-email duplicate-identity
-- bug. Also installs cleanup_phantom_auth_users() as an ongoing guard for
-- future regressions.

-- 1. Column addition (nullable for backfill)
ALTER TABLE public.users
  ADD COLUMN signup_method TEXT CHECK (signup_method IN ('whatsapp', 'email'));

-- 2. Backfill: WhatsApp-pattern first (joined to auth.users since the synthetic
-- email lives there), then email for everything else.
UPDATE public.users u
SET signup_method = 'whatsapp'
FROM auth.users a
WHERE a.id = u.id
  AND a.email LIKE 'wa\_%@auth.internal' ESCAPE '\';

UPDATE public.users
SET signup_method = 'email'
WHERE signup_method IS NULL;

-- 3. Lock NOT NULL now that all rows are classified.
ALTER TABLE public.users
  ALTER COLUMN signup_method SET NOT NULL;

-- 4. One-off phantom cleanup: delete synthetic-email auth.users rows that
-- have no model_profiles link. Today there is exactly one such row.
DELETE FROM auth.users
WHERE email LIKE 'wa\_%@auth.internal' ESCAPE '\'
  AND id NOT IN (SELECT user_id FROM public.model_profiles);

-- 5. Ongoing guard: SECURITY DEFINER function callable by service_role only.
-- Invoke from pg_cron or an admin endpoint to sweep any future phantoms.
CREATE OR REPLACE FUNCTION public.cleanup_phantom_auth_users()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count integer;
BEGIN
  WITH deleted AS (
    DELETE FROM auth.users
    WHERE email LIKE 'wa\_%@auth.internal' ESCAPE '\'
      AND id NOT IN (SELECT user_id FROM public.model_profiles)
    RETURNING id
  )
  SELECT count(*) INTO deleted_count FROM deleted;
  RETURN deleted_count;
END;
$$;

REVOKE ALL ON FUNCTION public.cleanup_phantom_auth_users() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cleanup_phantom_auth_users() TO service_role;
