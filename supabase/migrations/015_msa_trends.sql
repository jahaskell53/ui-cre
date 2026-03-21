-- MSA boundary data loaded from:
-- US Census Bureau TIGER/Line Shapefiles 2025
-- https://www.census.gov/geographies/mapping-files/time-series/geo/tiger-line-file.html
-- File: tl_2025_us_cbsa.zip (Core Based Statistical Areas)
-- Filtered to Metropolitan Statistical Areas only (MEMI = '1'), 393 MSAs.
-- Loaded via load_msas.py: converted to GeoJSON (ogr2ogr, simplified 0.01 deg,
-- reprojected NAD83→WGS84), inserted via Supabase Python client in batches of 100,
-- geom column populated with ST_Multi(ST_GeomFromGeoJSON(...)).

CREATE TABLE IF NOT EXISTS public.msa_boundaries (
  id         bigserial PRIMARY KEY,
  geoid      text UNIQUE NOT NULL,
  name       text NOT NULL,
  name_lsad  text,
  geom       geometry(MultiPolygon, 4326)
);

CREATE INDEX IF NOT EXISTS idx_msa_boundaries_geom ON public.msa_boundaries USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_msa_boundaries_name ON public.msa_boundaries (name);

CREATE OR REPLACE FUNCTION public.search_msas(p_query text)
RETURNS TABLE(id bigint, name text, name_lsad text, geoid text)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $function$
  SELECT id, name, name_lsad, geoid
  FROM msa_boundaries
  WHERE (name || ' ' || name_lsad) ILIKE '%' || regexp_replace(p_query, '[,\s]+', ' ', 'g') || '%'
  ORDER BY
    CASE WHEN name ILIKE '%' || regexp_replace(p_query, '[,\s]+', ' ', 'g') || '%' THEN 0 ELSE 1 END,
    name
  LIMIT 8;
$function$;

CREATE OR REPLACE FUNCTION public.get_rent_trends_by_msa(
  p_geoid text,
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
  JOIN msa_boundaries mb ON ST_Within(cl.geom, mb.geom)
  WHERE
    cl.geom IS NOT NULL
    AND mb.geoid = p_geoid
    AND cl.price IS NOT NULL AND cl.price > 500 AND cl.price < 30000
    AND (p_beds IS NULL OR CASE WHEN COALESCE(cl.beds, 0) >= 3 THEN 3 ELSE COALESCE(cl.beds, 0) END = p_beds)
    AND (
      (NOT p_reits_only AND cl.building_zpid IS NULL)
      OR (p_reits_only AND cl.building_zpid IS NOT NULL)
    )
  GROUP BY 1, 2
  ORDER BY 1, 2;
$function$;

CREATE OR REPLACE FUNCTION public.get_market_activity_by_msa(
  p_geoid text,
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
  JOIN msa_boundaries mb ON ST_Within(cl.geom, mb.geom)
  WHERE
    cl.geom IS NOT NULL
    AND mb.geoid = p_geoid
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

GRANT EXECUTE ON FUNCTION public.search_msas(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_rent_trends_by_msa(text, integer, boolean) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_market_activity_by_msa(text, boolean) TO anon, authenticated;
