-- Atomic cascade delete for an ambassador's model profile.
-- Runs all child-table deletes in a single implicit transaction so a partial
-- failure rolls back instead of leaving orphan rows. Replaces the prior
-- sequential .delete() chain in app/api/ambassador/model/settings/route.ts.
--
-- Skips model_professionals — that table is shared across ambassadors;
-- orphan cleanup is deferred to a separate maintenance task (see
-- DECODE_PROJECT_STATE.md pre-launch checklist).
--
-- Caller must already have verified that no payment rows exist for this
-- model_id; this function does NOT re-check.

CREATE OR REPLACE FUNCTION public.delete_model_profile_cascade(
  p_user_id uuid
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_model_id uuid;
BEGIN
  SELECT id INTO v_model_id
  FROM public.model_profiles
  WHERE user_id = p_user_id;

  IF v_model_id IS NULL THEN
    RETURN;
  END IF;

  DELETE FROM public.model_listing_payments WHERE model_id = v_model_id;
  DELETE FROM public.model_wish_payments    WHERE model_id = v_model_id;
  DELETE FROM public.model_analytics_events WHERE model_id = v_model_id;
  DELETE FROM public.model_wishes           WHERE model_id = v_model_id;
  DELETE FROM public.model_listings         WHERE model_id = v_model_id;
  DELETE FROM public.model_payouts          WHERE model_id = v_model_id;
  DELETE FROM public.model_profiles         WHERE user_id = p_user_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.delete_model_profile_cascade(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.delete_model_profile_cascade(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.delete_model_profile_cascade(uuid) FROM anon;
GRANT  EXECUTE ON FUNCTION public.delete_model_profile_cascade(uuid) TO service_role;
