-- Slice 7+ hotfix: backfill auth.users.phone for email-first users who added
-- WhatsApp via a path that wrote public.users.phone_number but not the auth
-- mirror. Then sweep any phantom synthetic-email auth.users rows left over
-- from verify-otp MISS-branch hits against those divergent users.
--
-- Today's audit (run via MCP read-only before authoring this migration):
--   SELECT COUNT(*) FROM public.users pu JOIN auth.users au ON au.id = pu.id
--   WHERE pu.phone_number IS NOT NULL AND au.phone IS NULL;
--   -> 1 row (ee379987-... "Yanni Johnson")
--
--   SELECT au.id FROM auth.users au LEFT JOIN public.users pu ON pu.id = au.id
--   WHERE au.email LIKE 'wa\_%@auth.internal' ESCAPE '\' AND pu.id IS NULL;
--   -> 1 row (eb3da119-... synthetic for +971554275547, created 2026-04-30)
--
-- Companion code change lands in same commit: verify-otp MISS branch detects
-- phone_number collision and collapses onto the existing user instead of
-- leaving a phantom (belt-and-suspenders for any future divergent regression).

BEGIN;

-- ──────────────────────────────────────────────────────────────────
-- Safety: refuse to run if divergent set is unexpectedly large.
-- Today's pre-flight = 1 row. >5 = something has gone wrong upstream
-- and partner should investigate before blanket-confirming phones.
-- ──────────────────────────────────────────────────────────────────
DO $$
DECLARE
  divergent_count int;
BEGIN
  SELECT COUNT(*) INTO divergent_count
  FROM public.users pu
  JOIN auth.users au ON au.id = pu.id
  WHERE pu.phone_number IS NOT NULL AND au.phone IS NULL;

  IF divergent_count > 5 THEN
    RAISE EXCEPTION 'Backfill aborted: % divergent rows found (expected <=5). Investigate upstream regression before applying.', divergent_count;
  END IF;
END $$;

-- ──────────────────────────────────────────────────────────────────
-- 1. Backfill auth.users.phone from public.users.phone_number for
--    rows where the auth column is NULL but the mirror is populated.
--
--    Format: auth.users.phone is digits-only (verify-otp normalizes
--    via .replace(/^\+/, '')). public.users.phone_number stores '+'.
--    Strip the leading '+'.
--
--    Set phone_confirmed_at = NOW() since the mirror was populated by
--    a path that already verified ownership (Add-Phone OTP flow or
--    direct test-data write — either way these users are trusted).
-- ──────────────────────────────────────────────────────────────────
UPDATE auth.users a
SET
  phone = regexp_replace(p.phone_number, '^\+', ''),
  phone_confirmed_at = NOW()
FROM public.users p
WHERE a.id = p.id
  AND a.phone IS NULL
  AND p.phone_number IS NOT NULL;

-- ──────────────────────────────────────────────────────────────────
-- 2. Phantom sweep, scoped to rows created >1h ago to avoid deleting
--    users mid-onboarding (between verify-otp success and /model/setup
--    completion). Tighter than the canonical
--    public.cleanup_phantom_auth_users() function which has no age
--    filter — that function is reused by cron / admin paths and is
--    intentionally left unchanged here. Inline DELETE applies the age
--    filter only for THIS one apply.
-- ──────────────────────────────────────────────────────────────────
DELETE FROM auth.users
WHERE email LIKE 'wa\_%@auth.internal' ESCAPE '\'
  AND id NOT IN (SELECT user_id FROM public.model_profiles WHERE user_id IS NOT NULL)
  AND created_at < NOW() - INTERVAL '1 hour';

COMMIT;
