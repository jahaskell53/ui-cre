-- Add p_home_type filter to all rent trends and market activity functions.
-- NULL means no filter (all home types).

-- get_rent_trends (ZIP) overload 2 (with p_reits_only)
CREATE OR REPLACE FUNCTION public.get_rent_trends(
  p_zip text DEFAULT NULL::text,
  p_beds integer DEFAULT NULL::integer,
  p_reits_only boolean DEFAULT false,
  p_home_type text DEFAULT NULL::text
)
 RETURNS TABLE(week_start date, beds integer, median_rent numeric, listing_count bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
  SELECT
    DATE_TRUNC('week', scraped_at)::date AS week_start,
    CASE WHEN beds IS NULL OR beds = 0 THEN 0 WHEN beds >= 3 THEN 3 ELSE beds END AS beds,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY price)::numeric AS median_rent,
    COUNT(*) AS listing_count
  FROM cleaned_listings
  WHERE
    price IS NOT NULL AND price > 500 AND price < 30000
    AND (p_zip IS NULL OR address_zip = p_zip)
    AND (p_beds IS NULL OR CASE WHEN beds IS NULL OR beds = 0 THEN 0 WHEN beds >= 3 THEN 3 ELSE beds END = p_beds)
    AND p_reits_only = (building_zpid IS NOT NULL)
    AND (p_home_type IS NULL OR home_type = p_home_type)
  GROUP BY 1, 2
  ORDER BY 1, 2;
$function$;

-- get_market_activity (ZIP)
CREATE OR REPLACE FUNCTION public.get_market_activity(
  p_zip text DEFAULT NULL::text,
  p_reits_only boolean DEFAULT false,
  p_home_type text DEFAULT NULL::text
)
RETURNS TABLE(week_start date, beds integer, new_listings bigint, accumulated_listings bigint, closed_listings bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
AS $function$
WITH weekly AS (
  SELECT DISTINCT
    DATE_TRUNC('week', scraped_at)::date AS week_start,
    zpid,
    CASE WHEN COALESCE(beds, 0) >= 3 THEN 3 ELSE COALESCE(beds, 0) END AS beds
  FROM cleaned_listings
  WHERE
    zpid IS NOT NULL
    AND price > 500 AND price < 30000
    AND (p_zip IS NULL OR address_zip = p_zip)
    AND ((NOT p_reits_only AND building_zpid IS NULL) OR (p_reits_only AND building_zpid IS NOT NULL))
    AND (p_home_type IS NULL OR home_type = p_home_type)
),
bounds AS (
  SELECT MAX(week_start) AS max_week FROM weekly
),
all_weeks AS (
  SELECT DISTINCT week_start FROM weekly
),
bed_types AS (SELECT DISTINCT beds FROM weekly),
new_counts AS (
  SELECT cur.week_start, cur.beds, COUNT(*) AS cnt
  FROM weekly cur
  LEFT JOIN weekly prev
    ON prev.zpid = cur.zpid AND prev.beds = cur.beds
    AND prev.week_start = cur.week_start - INTERVAL '7 days'
  WHERE prev.zpid IS NULL
  GROUP BY cur.week_start, cur.beds
),
closed_counts AS (
  SELECT (prev.week_start + INTERVAL '7 days')::date AS week_start, prev.beds, COUNT(*) AS cnt
  FROM weekly prev
  LEFT JOIN weekly nxt
    ON nxt.zpid = prev.zpid AND nxt.beds = prev.beds
    AND nxt.week_start = prev.week_start + INTERVAL '7 days'
  CROSS JOIN bounds
  WHERE nxt.zpid IS NULL
    AND (prev.week_start + INTERVAL '7 days')::date <= bounds.max_week
  GROUP BY 1, prev.beds
)
SELECT
  w.week_start,
  b.beds,
  COALESCE(n.cnt, 0) AS new_listings,
  COUNT(DISTINCT wl.zpid) AS accumulated_listings,
  COALESCE(c.cnt, 0) AS closed_listings
FROM all_weeks w
CROSS JOIN bed_types b
LEFT JOIN weekly wl ON wl.week_start = w.week_start AND wl.beds = b.beds
LEFT JOIN new_counts n ON n.week_start = w.week_start AND n.beds = b.beds
LEFT JOIN closed_counts c ON c.week_start = w.week_start AND c.beds = b.beds
GROUP BY w.week_start, b.beds, n.cnt, c.cnt
ORDER BY w.week_start, b.beds;
$function$;

-- get_rent_trends_by_neighborhood
CREATE OR REPLACE FUNCTION public.get_rent_trends_by_neighborhood(
  p_neighborhood_ids integer[],
  p_beds integer DEFAULT NULL,
  p_reits_only boolean DEFAULT false,
  p_home_type text DEFAULT NULL
)
RETURNS TABLE(week_start date, beds integer, median_rent numeric, listing_count bigint)
LANGUAGE sql STABLE SECURITY DEFINER
AS $function$
  SELECT
    DATE_TRUNC('week', cl.scraped_at)::date AS week_start,
    CASE WHEN COALESCE(cl.beds, 0) >= 3 THEN 3 ELSE COALESCE(cl.beds, 0) END AS beds,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY cl.price)::numeric AS median_rent,
    COUNT(*) AS listing_count
  FROM cleaned_listings cl
  JOIN neighborhoods n ON ST_Within(cl.geom, n.geom)
  WHERE
    cl.geom IS NOT NULL
    AND n.id = ANY(p_neighborhood_ids)
    AND cl.price IS NOT NULL AND cl.price > 500 AND cl.price < 30000
    AND (p_beds IS NULL OR CASE WHEN COALESCE(cl.beds, 0) >= 3 THEN 3 ELSE COALESCE(cl.beds, 0) END = p_beds)
    AND ((NOT p_reits_only AND cl.building_zpid IS NULL) OR (p_reits_only AND cl.building_zpid IS NOT NULL))
    AND (p_home_type IS NULL OR cl.home_type = p_home_type)
  GROUP BY 1, 2
  ORDER BY 1, 2;
$function$;

-- get_market_activity_by_neighborhood
CREATE OR REPLACE FUNCTION public.get_market_activity_by_neighborhood(
  p_neighborhood_ids integer[],
  p_reits_only boolean DEFAULT false,
  p_home_type text DEFAULT NULL
)
RETURNS TABLE(week_start date, beds integer, new_listings bigint, accumulated_listings bigint, closed_listings bigint)
LANGUAGE sql STABLE SECURITY DEFINER
AS $function$
WITH lifecycle AS (
  SELECT
    cl.zpid,
    CASE WHEN COALESCE(cl.beds, 0) >= 3 THEN 3 ELSE COALESCE(cl.beds, 0) END AS beds,
    MIN(DATE_TRUNC('week', cl.scraped_at)::date) AS first_seen,
    MAX(DATE_TRUNC('week', cl.scraped_at)::date) AS last_seen
  FROM cleaned_listings cl
  JOIN neighborhoods n ON ST_Within(cl.geom, n.geom)
  WHERE
    cl.geom IS NOT NULL
    AND n.id = ANY(p_neighborhood_ids)
    AND cl.zpid IS NOT NULL
    AND cl.price > 500 AND cl.price < 30000
    AND ((NOT p_reits_only AND cl.building_zpid IS NULL) OR (p_reits_only AND cl.building_zpid IS NOT NULL))
    AND (p_home_type IS NULL OR cl.home_type = p_home_type)
  GROUP BY cl.zpid, 2
),
bounds AS (SELECT MIN(first_seen) AS min_week, MAX(last_seen) AS max_week FROM lifecycle),
all_weeks AS (
  SELECT generate_series(min_week, max_week, interval '7 days')::date AS week_start
  FROM bounds WHERE min_week IS NOT NULL AND max_week IS NOT NULL
),
bed_types AS (SELECT DISTINCT beds FROM lifecycle)
SELECT
  w.week_start, b.beds,
  COUNT(*) FILTER (WHERE l.first_seen = w.week_start) AS new_listings,
  COUNT(*) FILTER (WHERE l.first_seen <= w.week_start AND l.last_seen >= w.week_start) AS accumulated_listings,
  COUNT(*) FILTER (WHERE l.last_seen = w.week_start AND l.last_seen > l.first_seen AND l.last_seen < (SELECT max_week FROM bounds)) AS closed_listings
FROM all_weeks w CROSS JOIN bed_types b JOIN lifecycle l ON l.beds = b.beds
GROUP BY w.week_start, b.beds ORDER BY w.week_start, b.beds;
$function$;

-- get_rent_trends_by_city
CREATE OR REPLACE FUNCTION public.get_rent_trends_by_city(
  p_city text, p_state text,
  p_beds integer DEFAULT NULL,
  p_reits_only boolean DEFAULT false,
  p_home_type text DEFAULT NULL
)
RETURNS TABLE(week_start date, beds integer, median_rent numeric, listing_count bigint)
LANGUAGE sql STABLE SECURITY DEFINER
AS $function$
  SELECT
    DATE_TRUNC('week', scraped_at)::date AS week_start,
    CASE WHEN COALESCE(beds, 0) >= 3 THEN 3 ELSE COALESCE(beds, 0) END AS beds,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY price)::numeric AS median_rent,
    COUNT(*) AS listing_count
  FROM cleaned_listings
  WHERE
    price IS NOT NULL AND price > 500 AND price < 30000
    AND address_city ILIKE p_city AND address_state ILIKE p_state
    AND (p_beds IS NULL OR CASE WHEN COALESCE(beds, 0) >= 3 THEN 3 ELSE COALESCE(beds, 0) END = p_beds)
    AND ((NOT p_reits_only AND building_zpid IS NULL) OR (p_reits_only AND building_zpid IS NOT NULL))
    AND (p_home_type IS NULL OR home_type = p_home_type)
  GROUP BY 1, 2 ORDER BY 1, 2;
$function$;

-- get_market_activity_by_city
CREATE OR REPLACE FUNCTION public.get_market_activity_by_city(
  p_city text, p_state text,
  p_reits_only boolean DEFAULT false,
  p_home_type text DEFAULT NULL
)
RETURNS TABLE(week_start date, beds integer, new_listings bigint, accumulated_listings bigint, closed_listings bigint)
LANGUAGE sql STABLE SECURITY DEFINER
AS $function$
WITH lifecycle AS (
  SELECT
    zpid,
    CASE WHEN COALESCE(beds, 0) >= 3 THEN 3 ELSE COALESCE(beds, 0) END AS beds,
    MIN(DATE_TRUNC('week', scraped_at)::date) AS first_seen,
    MAX(DATE_TRUNC('week', scraped_at)::date) AS last_seen
  FROM cleaned_listings
  WHERE zpid IS NOT NULL AND price > 500 AND price < 30000
    AND address_city ILIKE p_city AND address_state ILIKE p_state
    AND ((NOT p_reits_only AND building_zpid IS NULL) OR (p_reits_only AND building_zpid IS NOT NULL))
    AND (p_home_type IS NULL OR home_type = p_home_type)
  GROUP BY zpid, 2
),
bounds AS (SELECT MIN(first_seen) AS min_week, MAX(last_seen) AS max_week FROM lifecycle),
all_weeks AS (
  SELECT generate_series(min_week, max_week, interval '7 days')::date AS week_start
  FROM bounds WHERE min_week IS NOT NULL AND max_week IS NOT NULL
),
bed_types AS (SELECT DISTINCT beds FROM lifecycle)
SELECT
  w.week_start, b.beds,
  COUNT(*) FILTER (WHERE l.first_seen = w.week_start) AS new_listings,
  COUNT(*) FILTER (WHERE l.first_seen <= w.week_start AND l.last_seen >= w.week_start) AS accumulated_listings,
  COUNT(*) FILTER (WHERE l.last_seen = w.week_start AND l.last_seen > l.first_seen AND l.last_seen < (SELECT max_week FROM bounds)) AS closed_listings
FROM all_weeks w CROSS JOIN bed_types b JOIN lifecycle l ON l.beds = b.beds
GROUP BY w.week_start, b.beds ORDER BY w.week_start, b.beds;
$function$;

-- get_rent_trends_by_county
CREATE OR REPLACE FUNCTION public.get_rent_trends_by_county(
  p_county_name text, p_state text,
  p_beds integer DEFAULT NULL,
  p_reits_only boolean DEFAULT false,
  p_home_type text DEFAULT NULL
)
RETURNS TABLE(week_start date, beds integer, median_rent numeric, listing_count bigint)
LANGUAGE sql STABLE SECURITY DEFINER
AS $function$
  SELECT
    DATE_TRUNC('week', cl.scraped_at)::date AS week_start,
    CASE WHEN COALESCE(cl.beds, 0) >= 3 THEN 3 ELSE COALESCE(cl.beds, 0) END AS beds,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY cl.price)::numeric AS median_rent,
    COUNT(*) AS listing_count
  FROM cleaned_listings cl
  JOIN county_boundaries cb ON ST_Within(cl.geom, cb.geom)
  WHERE
    cl.geom IS NOT NULL AND cb.name_lsad ILIKE p_county_name AND cb.state = p_state
    AND cl.price IS NOT NULL AND cl.price > 500 AND cl.price < 30000
    AND (p_beds IS NULL OR CASE WHEN COALESCE(cl.beds, 0) >= 3 THEN 3 ELSE COALESCE(cl.beds, 0) END = p_beds)
    AND ((NOT p_reits_only AND cl.building_zpid IS NULL) OR (p_reits_only AND cl.building_zpid IS NOT NULL))
    AND (p_home_type IS NULL OR cl.home_type = p_home_type)
  GROUP BY 1, 2 ORDER BY 1, 2;
$function$;

-- get_market_activity_by_county
CREATE OR REPLACE FUNCTION public.get_market_activity_by_county(
  p_county_name text, p_state text,
  p_reits_only boolean DEFAULT false,
  p_home_type text DEFAULT NULL
)
RETURNS TABLE(week_start date, beds integer, new_listings bigint, accumulated_listings bigint, closed_listings bigint)
LANGUAGE sql STABLE SECURITY DEFINER
AS $function$
WITH lifecycle AS (
  SELECT
    cl.zpid,
    CASE WHEN COALESCE(cl.beds, 0) >= 3 THEN 3 ELSE COALESCE(cl.beds, 0) END AS beds,
    MIN(DATE_TRUNC('week', cl.scraped_at)::date) AS first_seen,
    MAX(DATE_TRUNC('week', cl.scraped_at)::date) AS last_seen
  FROM cleaned_listings cl
  JOIN county_boundaries cb ON ST_Within(cl.geom, cb.geom)
  WHERE
    cl.geom IS NOT NULL AND cb.name_lsad ILIKE p_county_name AND cb.state = p_state
    AND cl.zpid IS NOT NULL AND cl.price > 500 AND cl.price < 30000
    AND ((NOT p_reits_only AND cl.building_zpid IS NULL) OR (p_reits_only AND cl.building_zpid IS NOT NULL))
    AND (p_home_type IS NULL OR cl.home_type = p_home_type)
  GROUP BY cl.zpid, 2
),
bounds AS (SELECT MIN(first_seen) AS min_week, MAX(last_seen) AS max_week FROM lifecycle),
all_weeks AS (
  SELECT generate_series(min_week, max_week, interval '7 days')::date AS week_start
  FROM bounds WHERE min_week IS NOT NULL AND max_week IS NOT NULL
),
bed_types AS (SELECT DISTINCT beds FROM lifecycle)
SELECT
  w.week_start, b.beds,
  COUNT(*) FILTER (WHERE l.first_seen = w.week_start) AS new_listings,
  COUNT(*) FILTER (WHERE l.first_seen <= w.week_start AND l.last_seen >= w.week_start) AS accumulated_listings,
  COUNT(*) FILTER (WHERE l.last_seen = w.week_start AND l.last_seen > l.first_seen AND l.last_seen < (SELECT max_week FROM bounds)) AS closed_listings
FROM all_weeks w CROSS JOIN bed_types b JOIN lifecycle l ON l.beds = b.beds
GROUP BY w.week_start, b.beds ORDER BY w.week_start, b.beds;
$function$;

-- get_rent_trends_by_msa
CREATE OR REPLACE FUNCTION public.get_rent_trends_by_msa(
  p_geoid text,
  p_beds integer DEFAULT NULL,
  p_reits_only boolean DEFAULT false,
  p_home_type text DEFAULT NULL
)
RETURNS TABLE(week_start date, beds integer, median_rent numeric, listing_count bigint)
LANGUAGE sql STABLE SECURITY DEFINER
AS $function$
  SELECT
    DATE_TRUNC('week', cl.scraped_at)::date AS week_start,
    CASE WHEN COALESCE(cl.beds, 0) >= 3 THEN 3 ELSE COALESCE(cl.beds, 0) END AS beds,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY cl.price)::numeric AS median_rent,
    COUNT(*) AS listing_count
  FROM cleaned_listings cl
  JOIN msa_boundaries mb ON ST_Within(cl.geom, mb.geom)
  WHERE
    cl.geom IS NOT NULL AND mb.geoid = p_geoid
    AND cl.price IS NOT NULL AND cl.price > 500 AND cl.price < 30000
    AND (p_beds IS NULL OR CASE WHEN COALESCE(cl.beds, 0) >= 3 THEN 3 ELSE COALESCE(cl.beds, 0) END = p_beds)
    AND ((NOT p_reits_only AND cl.building_zpid IS NULL) OR (p_reits_only AND cl.building_zpid IS NOT NULL))
    AND (p_home_type IS NULL OR cl.home_type = p_home_type)
  GROUP BY 1, 2 ORDER BY 1, 2;
$function$;

-- get_market_activity_by_msa
CREATE OR REPLACE FUNCTION public.get_market_activity_by_msa(
  p_geoid text,
  p_reits_only boolean DEFAULT false,
  p_home_type text DEFAULT NULL
)
RETURNS TABLE(week_start date, beds integer, new_listings bigint, accumulated_listings bigint, closed_listings bigint)
LANGUAGE sql STABLE SECURITY DEFINER
AS $function$
WITH lifecycle AS (
  SELECT
    cl.zpid,
    CASE WHEN COALESCE(cl.beds, 0) >= 3 THEN 3 ELSE COALESCE(cl.beds, 0) END AS beds,
    MIN(DATE_TRUNC('week', cl.scraped_at)::date) AS first_seen,
    MAX(DATE_TRUNC('week', cl.scraped_at)::date) AS last_seen
  FROM cleaned_listings cl
  JOIN msa_boundaries mb ON ST_Within(cl.geom, mb.geom)
  WHERE
    cl.geom IS NOT NULL AND mb.geoid = p_geoid
    AND cl.zpid IS NOT NULL AND cl.price > 500 AND cl.price < 30000
    AND ((NOT p_reits_only AND cl.building_zpid IS NULL) OR (p_reits_only AND cl.building_zpid IS NOT NULL))
    AND (p_home_type IS NULL OR cl.home_type = p_home_type)
  GROUP BY cl.zpid, 2
),
bounds AS (SELECT MIN(first_seen) AS min_week, MAX(last_seen) AS max_week FROM lifecycle),
all_weeks AS (
  SELECT generate_series(min_week, max_week, interval '7 days')::date AS week_start
  FROM bounds WHERE min_week IS NOT NULL AND max_week IS NOT NULL
),
bed_types AS (SELECT DISTINCT beds FROM lifecycle)
SELECT
  w.week_start, b.beds,
  COUNT(*) FILTER (WHERE l.first_seen = w.week_start) AS new_listings,
  COUNT(*) FILTER (WHERE l.first_seen <= w.week_start AND l.last_seen >= w.week_start) AS accumulated_listings,
  COUNT(*) FILTER (WHERE l.last_seen = w.week_start AND l.last_seen > l.first_seen AND l.last_seen < (SELECT max_week FROM bounds)) AS closed_listings
FROM all_weeks w CROSS JOIN bed_types b JOIN lifecycle l ON l.beds = b.beds
GROUP BY w.week_start, b.beds ORDER BY w.week_start, b.beds;
$function$;

GRANT EXECUTE ON FUNCTION public.get_rent_trends(text, integer, boolean, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_market_activity(text, boolean, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_rent_trends_by_neighborhood(integer[], integer, boolean, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_market_activity_by_neighborhood(integer[], boolean, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_rent_trends_by_city(text, text, integer, boolean, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_market_activity_by_city(text, text, boolean, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_rent_trends_by_county(text, text, integer, boolean, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_market_activity_by_county(text, text, boolean, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_rent_trends_by_msa(text, integer, boolean, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_market_activity_by_msa(text, boolean, text) TO anon, authenticated;
