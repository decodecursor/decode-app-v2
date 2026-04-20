-- Opaque-token store for the ambassador Add Email flow.
-- Replaces Supabase GoTrue's PKCE-bound email_change_new tokens with a
-- server-owned random token that works cross-browser / cross-device.
-- Service-role only: RLS is enabled with zero policies, so anon/authed
-- clients are blocked. Only the service-role key bypasses RLS.

CREATE TABLE public.email_change_requests (
  token TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  new_email TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_email_change_requests_user_id
  ON public.email_change_requests(user_id)
  WHERE consumed_at IS NULL;

CREATE INDEX idx_email_change_requests_expires
  ON public.email_change_requests(expires_at)
  WHERE consumed_at IS NULL;

ALTER TABLE public.email_change_requests ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.email_change_requests IS
  'Opaque-token store for ambassador Add Email flow. Service-role only (no RLS policies). Rows invalidated via consumed_at; GC expired/consumed rows in a later cron.';
