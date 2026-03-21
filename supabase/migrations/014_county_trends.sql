CREATE TABLE IF NOT EXISTS public.county_boundaries (
  id         bigserial PRIMARY KEY,
  geoid      text UNIQUE NOT NULL,
  name       text NOT NULL,
  name_lsad  text,
  state_fips text,
  state      text,
  geom       geometry(MultiPolygon, 4326)
);

CREATE INDEX IF NOT EXISTS idx_county_boundaries_geom ON public.county_boundaries USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_county_boundaries_state ON public.county_boundaries (state);
CREATE INDEX IF NOT EXISTS idx_county_boundaries_name ON public.county_boundaries (name, state);

CREATE OR REPLACE FUNCTION public.get_rent_trends_by_county(
  p_county_name text,
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
    DATE_TRUNC('week', cl.scraped_at)::date AS week_start,
    CASE WHEN COALESCE(cl.beds, 0) >= 3 THEN 3 ELSE COALESCE(cl.beds, 0) END AS beds,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY cl.price)::numeric AS median_rent,
    COUNT(*) AS listing_count
  FROM cleaned_listings cl
  JOIN county_boundaries cb ON ST_Within(cl.geom, cb.geom)
  WHERE
    cl.geom IS NOT NULL
    AND cb.name_lsad ILIKE p_county_name
    AND cb.state = p_state
    AND cl.price IS NOT NULL AND cl.price > 500 AND cl.price < 30000
    AND (p_beds IS NULL OR CASE WHEN COALESCE(cl.beds, 0) >= 3 THEN 3 ELSE COALESCE(cl.beds, 0) END = p_beds)
    AND (
      (NOT p_reits_only AND cl.building_zpid IS NULL)
      OR (p_reits_only AND cl.building_zpid IS NOT NULL)
    )
  GROUP BY 1, 2
  ORDER BY 1, 2;
$function$;

CREATE OR REPLACE FUNCTION public.get_market_activity_by_county(
  p_county_name text,
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
    cl.zpid,
    CASE WHEN COALESCE(cl.beds, 0) >= 3 THEN 3 ELSE COALESCE(cl.beds, 0) END AS beds,
    MIN(DATE_TRUNC('week', cl.scraped_at)::date) AS first_seen,
    MAX(DATE_TRUNC('week', cl.scraped_at)::date) AS last_seen
  FROM cleaned_listings cl
  JOIN county_boundaries cb ON ST_Within(cl.geom, cb.geom)
  WHERE
    cl.geom IS NOT NULL
    AND cb.name_lsad ILIKE p_county_name
    AND cb.state = p_state
    AND cl.zpid IS NOT NULL
    AND cl.price > 500 AND cl.price < 30000
    AND (
      (NOT p_reits_only AND cl.building_zpid IS NULL)
      OR (p_reits_only AND cl.building_zpid IS NOT NULL)
    )
  GROUP BY cl.zpid, 2
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

GRANT EXECUTE ON FUNCTION public.get_rent_trends_by_county(text, text, integer, boolean) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_market_activity_by_county(text, text, boolean) TO anon, authenticated;
