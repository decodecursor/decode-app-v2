-- Slice H2: model_payouts FK cascade fix
-- Latent bug: model_profiles.user_id cascades from public.users, but
-- model_payouts.model_id -> model_profiles was NO ACTION. If parent chain
-- cascaded through, payouts constraint would block. Empty table today.
-- beauty_offers / beauty_purchases intentionally deferred -- both have
-- NOT NULL created_by/buyer_id; SET NULL requires dropping NOT NULL +
-- code audit for NULL handling. Future dedicated slice.

BEGIN;

ALTER TABLE public.model_payouts
  DROP CONSTRAINT model_payouts_model_id_fkey;
ALTER TABLE public.model_payouts
  ADD CONSTRAINT model_payouts_model_id_fkey
  FOREIGN KEY (model_id)
  REFERENCES public.model_profiles(id)
  ON DELETE CASCADE;

COMMIT;
