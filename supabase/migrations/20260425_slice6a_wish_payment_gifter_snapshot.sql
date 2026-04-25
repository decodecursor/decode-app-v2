-- ============================================================================
-- Slice 6A — Wish payment gifter snapshot columns
-- Date: 2026-04-25
-- ============================================================================
--
-- Adds gifter_name + gifter_instagram + gifter_is_anonymous snapshot columns
-- to model_wish_payments. These survive wish re-claim semantics: the
-- model_wishes.gifter_* columns are intentionally clobbered on subsequent
-- claims (per Slice 5C closeout: "gifter_B clobbers gifter_A's stale data —
-- schema-designed"), so any analytics or statement display that needs to
-- attribute a completed gift to a specific gifter must read from a snapshot
-- on the payment row, NOT from the wish row.
--
-- Slice 5C webhook handler (lib/ambassador/webhook-handlers/wish.ts) is
-- updated in the same commit-pair to populate these columns at payment
-- completion time by reading from the wish row at that moment. Going
-- forward the snapshot is correct.
--
-- Existing rows are backfilled from model_wishes joined by wish_id. For
-- never-re-claimed wishes the backfill is exact; for re-claimed wishes
-- the backfill captures the most recent state (best-effort, since the
-- claim-time state is gone). Live data today: 0 wish payments
-- (verified pre-migration via SELECT COUNT(*) FROM model_wish_payments;
-- if non-zero at apply time the backfill still runs idempotently).
--
-- Defense-in-depth CHECK: when gifter_is_anonymous=true the name + IG
-- columns must be NULL. The /api/checkout/wish + webhook code path
-- already enforces this; the constraint is the schema-side belt-and-
-- suspenders so a future writer can't accidentally surface a real name
-- on an "anonymous" gift.
--
-- ============================================================================

ALTER TABLE public.model_wish_payments
  ADD COLUMN IF NOT EXISTS gifter_name           TEXT,
  ADD COLUMN IF NOT EXISTS gifter_instagram      TEXT,
  ADD COLUMN IF NOT EXISTS gifter_is_anonymous   BOOLEAN NOT NULL DEFAULT FALSE;

-- Backfill from model_wishes for existing rows (idempotent).
UPDATE public.model_wish_payments p
SET
  gifter_name         = w.gifter_name,
  gifter_instagram    = w.gifter_instagram,
  gifter_is_anonymous = COALESCE(w.gifter_is_anonymous, FALSE)
FROM public.model_wishes w
WHERE p.wish_id = w.id
  AND p.gifter_name IS NULL
  AND p.gifter_instagram IS NULL;

-- Defense-in-depth: anonymous gifts must not carry name/IG snapshot.
ALTER TABLE public.model_wish_payments
  DROP CONSTRAINT IF EXISTS model_wish_payments_anonymous_no_identity;
ALTER TABLE public.model_wish_payments
  ADD CONSTRAINT model_wish_payments_anonymous_no_identity
  CHECK (
    gifter_is_anonymous = FALSE
    OR (gifter_name IS NULL AND gifter_instagram IS NULL)
  );

-- Index for the top-gifter analytics query: GROUP BY gifter_name across
-- non-anonymous completed payments per model. Partial index keeps it
-- small (anonymous + non-completed rows excluded — irrelevant to the
-- ranking query).
CREATE INDEX IF NOT EXISTS idx_model_wish_payments_gifter_ranking
  ON public.model_wish_payments (model_id, gifter_name, created_at DESC)
  WHERE status = 'completed' AND gifter_is_anonymous = FALSE;
