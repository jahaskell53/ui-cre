CREATE OR REPLACE FUNCTION public.get_rent_trends_by_city(
  p_city text,
  p_state text,
  p_beds integer DEFAULT NULL,
  p_reits_only boolean DEFAULT false
)
RETURNS TABLE(
  week_start date,
  beds integer,
  median_rent numeric,
  listing_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $function$
  SELECT
    DATE_TRUNC('week', scraped_at)::date AS week_start,
    CASE WHEN COALESCE(beds, 0) >= 3 THEN 3 ELSE COALESCE(beds, 0) END AS beds,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY price)::numeric AS median_rent,
    COUNT(*) AS listing_count
  FROM cleaned_listings
  WHERE
    price IS NOT NULL AND price > 500 AND price < 30000
    AND address_city ILIKE p_city
    AND address_state ILIKE p_state
    AND (p_beds IS NULL OR CASE WHEN COALESCE(beds, 0) >= 3 THEN 3 ELSE COALESCE(beds, 0) END = p_beds)
    AND (
      (NOT p_reits_only AND building_zpid IS NULL)
      OR (p_reits_only AND building_zpid IS NOT NULL)
    )
  GROUP BY 1, 2
  ORDER BY 1, 2;
$function$;

CREATE OR REPLACE FUNCTION public.get_market_activity_by_city(
  p_city text,
  p_state text,
  p_reits_only boolean DEFAULT false
)
RETURNS TABLE(
  week_start date,
  beds integer,
  new_listings bigint,
  accumulated_listings bigint,
  closed_listings bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $function$
WITH lifecycle AS (
  SELECT
    zpid,
    CASE WHEN COALESCE(beds, 0) >= 3 THEN 3 ELSE COALESCE(beds, 0) END AS beds,
    MIN(DATE_TRUNC('week', scraped_at)::date) AS first_seen,
    MAX(DATE_TRUNC('week', scraped_at)::date) AS last_seen
  FROM cleaned_listings
  WHERE
    zpid IS NOT NULL
    AND price > 500 AND price < 30000
    AND address_city ILIKE p_city
    AND address_state ILIKE p_state
    AND (
      (NOT p_reits_only AND building_zpid IS NULL)
      OR (p_reits_only AND building_zpid IS NOT NULL)
    )
  GROUP BY zpid, 2
),
bounds AS (
  SELECT MIN(first_seen) AS min_week, MAX(last_seen) AS max_week FROM lifecycle
),
all_weeks AS (
  SELECT generate_series(min_week, max_week, interval '7 days')::date AS week_start
  FROM bounds
  WHERE min_week IS NOT NULL AND max_week IS NOT NULL
),
bed_types AS (SELECT DISTINCT beds FROM lifecycle)
SELECT
  w.week_start,
  b.beds,
  COUNT(*) FILTER (WHERE l.first_seen = w.week_start) AS new_listings,
  COUNT(*) FILTER (WHERE l.first_seen <= w.week_start AND l.last_seen >= w.week_start) AS accumulated_listings,
  COUNT(*) FILTER (
    WHERE l.last_seen = w.week_start
      AND l.last_seen > l.first_seen
      AND l.last_seen < (SELECT max_week FROM bounds)
  ) AS closed_listings
FROM all_weeks w
CROSS JOIN bed_types b
JOIN lifecycle l ON l.beds = b.beds
GROUP BY w.week_start, b.beds
ORDER BY w.week_start, b.beds;
$function$;

GRANT EXECUTE ON FUNCTION public.get_rent_trends_by_city(text, text, integer, boolean) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_market_activity_by_city(text, text, boolean) TO anon, authenticated;
