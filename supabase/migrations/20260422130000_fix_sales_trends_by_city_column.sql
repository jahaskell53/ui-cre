-- Fix get_sales_trends_by_city to filter on address_city / address_state
-- instead of the raw city / state columns.
--
-- The raw `city` and `state` columns on loopnet_listing_details come directly
-- from the Apify scraper and may be empty for listings where the city is only
-- available after address normalization (stored in address_city / address_state).
-- All other city-based RPCs (rent trends, market activity) correctly use
-- address_city / address_state, and the table has a btree index on
-- (lower(address_city), lower(address_state)) to support this pattern.

CREATE OR REPLACE FUNCTION public.get_sales_trends_by_city(
  p_city text,
  p_state text
)
RETURNS TABLE(month_start date, median_price numeric, avg_cap_rate numeric, listing_count bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
AS $function$
  SELECT
    DATE_TRUNC('month', s.scraped_at)::date AS month_start,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY s.price_numeric)::numeric AS median_price,
    AVG((REGEXP_MATCH(s.cap_rate, '([0-9]+\.?[0-9]*)'))[1]::numeric) AS avg_cap_rate,
    COUNT(*) AS listing_count
  FROM loopnet_listing_snapshots s
  JOIN loopnet_listing_details d ON d.listing_url = s.listing_url
  WHERE
    s.price_numeric IS NOT NULL AND s.price_numeric > 0
    AND d.address_city ILIKE p_city
    AND d.address_state ILIKE p_state
  GROUP BY 1
  ORDER BY 1;
$function$;
