-- Fix sales trends spatial RPCs to use loopnet_listing_details.geom instead of raw lat/lng.
--
-- The loopnet_decompose_details_snapshots migration split loopnet_listings into
-- loopnet_listing_snapshots (one row per scrape) and loopnet_listing_details
-- (canonical per-listing detail). The spatial RPCs were updated to use that schema
-- but still build an ad-hoc point from d.longitude / d.latitude and require both
-- to be non-null, which excludes listings where only geom is set.
--
-- loopnet_listing_details.geom carries a GiST index and is populated for all
-- geocoded rows. Using it directly for the spatial JOIN matches how rent trend
-- RPCs use cleaned_listings.geom and allows Postgres to use the index.

CREATE OR REPLACE FUNCTION public.get_sales_trends_by_neighborhood(
  p_neighborhood_ids integer[]
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
  JOIN neighborhoods n
    ON ST_Within(d.geom, n.geom)
  WHERE
    s.price_numeric IS NOT NULL AND s.price_numeric > 0
    AND d.geom IS NOT NULL
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
    DATE_TRUNC('month', s.scraped_at)::date AS month_start,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY s.price_numeric)::numeric AS median_price,
    AVG((REGEXP_MATCH(s.cap_rate, '([0-9]+\.?[0-9]*)'))[1]::numeric) AS avg_cap_rate,
    COUNT(*) AS listing_count
  FROM loopnet_listing_snapshots s
  JOIN loopnet_listing_details d ON d.listing_url = s.listing_url
  JOIN msa_boundaries mb
    ON ST_Within(d.geom, mb.geom)
  WHERE
    s.price_numeric IS NOT NULL AND s.price_numeric > 0
    AND d.geom IS NOT NULL
    AND mb.geoid = p_geoid
  GROUP BY 1
  ORDER BY 1;
$function$;
