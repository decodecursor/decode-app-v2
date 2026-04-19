-- Harden get_top_click_categories: revoke EXECUTE from authenticated/anon.
-- Function is SECURITY DEFINER and accepts an arbitrary p_model_id, which
-- means any authenticated user could query click stats for any ambassador.
-- The dashboard server component runs with service_role, so authenticated
-- access is unnecessary.

REVOKE EXECUTE ON FUNCTION public.get_top_click_categories(uuid, int) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.get_top_click_categories(uuid, int) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_top_click_categories(uuid, int) FROM PUBLIC;

-- service_role grant remains (carried over from the original migration).
GRANT EXECUTE ON FUNCTION public.get_top_click_categories(uuid, int) TO service_role;
