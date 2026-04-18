-- Top-3 click categories for the ambassador dashboard.
-- Aggregates listing-click analytics events by category label
-- (falling back to category_custom for ad-hoc categories).

CREATE OR REPLACE FUNCTION public.get_top_click_categories(
  p_model_id uuid,
  p_limit int DEFAULT 3
) RETURNS TABLE(category text, clicks bigint)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT COALESCE(c.label, l.category_custom, 'Other') AS category,
         COUNT(*)::bigint AS clicks
  FROM public.model_analytics_events e
  JOIN public.model_listings l ON l.id = e.target_id
  LEFT JOIN public.model_categories c ON c.id = l.category_id
  WHERE e.model_id = p_model_id
    AND e.event_type IN ('listing_instagram_click','listing_media_click')
    AND e.target_id IS NOT NULL
  GROUP BY 1
  ORDER BY clicks DESC
  LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION public.get_top_click_categories(uuid, int) TO authenticated, service_role;
