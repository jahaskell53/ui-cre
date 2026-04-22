-- Fix sales trends spatial RPCs to use loopnet_listings.geom instead of raw lat/lng.
--
-- The previous versions of get_sales_trends_by_neighborhood, get_sales_trends_by_county,
-- and get_sales_trends_by_msa built an ad-hoc point from ll.longitude / ll.latitude and
-- required both columns to be non-null. This excluded listings that were geocoded via the
-- Dagster backfill job (which populates ll.geom but leaves latitude/longitude NULL).
--
-- The fix mirrors how rent trend RPCs use cleaned_listings.geom: join on ll.geom directly,
-- which is always populated for geocoded rows and carries a GiST index.

CREATE OR REPLACE FUNCTION public.get_sales_trends_by_neighborhood(
  p_neighborhood_ids integer[]
)
RETURNS TABLE(month_start date, median_price numeric, avg_cap_rate numeric, listing_count bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
AS $function$
  SELECT
    DATE_TRUNC('month', ll.scraped_at)::date AS month_start,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ll.price_numeric)::numeric AS median_price,
    AVG((REGEXP_MATCH(ll.cap_rate, '([0-9]+\.?[0-9]*)'))[1]::numeric) AS avg_cap_rate,
    COUNT(*) AS listing_count
  FROM loopnet_listings ll
  JOIN neighborhoods n
    ON ST_Within(ll.geom, n.geom)
  WHERE
    ll.price_numeric IS NOT NULL AND ll.price_numeric > 0
    AND ll.geom IS NOT NULL
    AND n.id = ANY(p_neighborhood_ids)
  GROUP BY 1
  ORDER BY 1;
$function$;

CREATE OR REPLACE FUNCTION public.get_sales_trends_by_county(
  p_county_name text,
  p_state text
)
RETURNS TABLE(month_start date, median_price numeric, avg_cap_rate numeric, listing_count bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
AS $function$
  SELECT
    DATE_TRUNC('month', ll.scraped_at)::date AS month_start,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ll.price_numeric)::numeric AS median_price,
    AVG((REGEXP_MATCH(ll.cap_rate, '([0-9]+\.?[0-9]*)'))[1]::numeric) AS avg_cap_rate,
    COUNT(*) AS listing_count
  FROM loopnet_listings ll
  JOIN county_boundaries cb
    ON ST_Within(ll.geom, cb.geom)
  WHERE
    ll.price_numeric IS NOT NULL AND ll.price_numeric > 0
    AND ll.geom IS NOT NULL
    AND cb.name ILIKE p_county_name
    AND cb.state = p_state
  GROUP BY 1
  ORDER BY 1;
$function$;

CREATE OR REPLACE FUNCTION public.get_sales_trends_by_msa(
  p_geoid text
)
RETURNS TABLE(month_start date, median_price numeric, avg_cap_rate numeric, listing_count bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
AS $function$
  SELECT
    DATE_TRUNC('month', ll.scraped_at)::date AS month_start,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ll.price_numeric)::numeric AS median_price,
    AVG((REGEXP_MATCH(ll.cap_rate, '([0-9]+\.?[0-9]*)'))[1]::numeric) AS avg_cap_rate,
    COUNT(*) AS listing_count
  FROM loopnet_listings ll
  JOIN msa_boundaries mb
    ON ST_Within(ll.geom, mb.geom)
  WHERE
    ll.price_numeric IS NOT NULL AND ll.price_numeric > 0
    AND ll.geom IS NOT NULL
    AND mb.geoid = p_geoid
  GROUP BY 1
  ORDER BY 1;
$function$;
