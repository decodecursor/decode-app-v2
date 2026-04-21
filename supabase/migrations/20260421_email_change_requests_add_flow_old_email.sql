-- Slice 2 B1: extend email_change_requests to support Change Email flow.
-- Add Email (Slice 1.5) and Change Email (Slice 2) share the same opaque-token
-- pipeline. These two additive columns let the callback distinguish flows and
-- the post-consume confirmation page render Old → New without URL params.

ALTER TABLE public.email_change_requests
  ADD COLUMN old_email TEXT NULL,
  ADD COLUMN flow TEXT NOT NULL DEFAULT 'add' CHECK (flow IN ('add','change'));

COMMENT ON COLUMN public.email_change_requests.old_email IS
  'Snapshot of the user''s email at request-creation time. NULL for Slice 1.5 Add Email rows (old is the synthetic wa_...@auth.internal fixture). Populated for Change flow so /model/auth/email-changed can server-render Old → New cards.';

COMMENT ON COLUMN public.email_change_requests.flow IS
  'Discriminator: ''add'' (Slice 1.5 Add Email) or ''change'' (Slice 2 Change Email). Drives callback redirect branch in /model/auth/confirm-email and subject/body variation in /api/ambassador/auth/add-email.';
