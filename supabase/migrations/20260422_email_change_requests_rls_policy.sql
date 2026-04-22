-- Slice 2 closeout: add explicit service-role RLS policy to email_change_requests.
--
-- Inherited from Slice 1.5: 20260420_email_change_requests.sql created the table
-- with ENABLE ROW LEVEL SECURITY and zero policies. Functionally safe throughout
-- (every .from('email_change_requests') callsite uses createServiceRoleClient(),
-- and RLS-enabled-no-policies defaults-denies anon/authenticated). Surfaced during
-- Slice 2 code review, fixed in closeout so a future pg_policies audit groups this
-- table with the otp_verifications service-role policy cleanly.
--
-- Mirrors only the service-role half of otp_verifications (name + role target +
-- USING clause verbatim). No self-read policy — no self-read caller exists or is
-- planned; the email-changed page is a server component using service-role.
-- (Principle E applied to RLS: don't build the path until there's a caller.)

BEGIN;

CREATE POLICY "Service role full access"
ON public.email_change_requests
AS PERMISSIVE
FOR ALL
TO public
USING ((auth.jwt() ->> 'role'::text) = 'service_role'::text);

COMMIT;
