-- Fix get_sales_trends_by_county to filter on name_lsad instead of name.
--
-- county_boundaries.name stores the bare name ("San Mateo") while
-- county_boundaries.name_lsad stores the full legal name ("San Mateo County").
-- Mapbox Geocoding returns the full name with the "County" suffix in feature.text,
-- so the p_county_name parameter always contains the suffix.
-- All other county-based RPCs (rent trends, market activity) already use name_lsad;
-- this aligns get_sales_trends_by_county with that convention.

CREATE OR REPLACE FUNCTION public.get_sales_trends_by_county(
  p_county_name text,
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
  JOIN county_boundaries cb
    ON ST_Within(d.geom, cb.geom)
  WHERE
    s.price_numeric IS NOT NULL AND s.price_numeric > 0
    AND d.geom IS NOT NULL
    AND cb.name_lsad ILIKE p_county_name
    AND cb.state = p_state
  GROUP BY 1
  ORDER BY 1;
$function$;
