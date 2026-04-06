-- Exclude TOWNHOUSE home type from rental listings, trends, map trends, and comps.
-- This mirrors the existing hard exclusion for SINGLE_FAMILY and ensures "All" does not include townhomes.

-- get_rent_trends (ZIP)
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
    AND home_type IS DISTINCT FROM 'SINGLE_FAMILY'
    AND home_type IS DISTINCT FROM 'TOWNHOUSE'
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
    AND home_type IS DISTINCT FROM 'SINGLE_FAMILY'
    AND home_type IS DISTINCT FROM 'TOWNHOUSE'
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
    AND cl.home_type IS DISTINCT FROM 'SINGLE_FAMILY'
    AND cl.home_type IS DISTINCT FROM 'TOWNHOUSE'
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
    AND cl.home_type IS DISTINCT FROM 'SINGLE_FAMILY'
    AND cl.home_type IS DISTINCT FROM 'TOWNHOUSE'
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
    AND home_type IS DISTINCT FROM 'SINGLE_FAMILY'
    AND home_type IS DISTINCT FROM 'TOWNHOUSE'
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
    AND home_type IS DISTINCT FROM 'SINGLE_FAMILY'
    AND home_type IS DISTINCT FROM 'TOWNHOUSE'
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
    AND cl.home_type IS DISTINCT FROM 'SINGLE_FAMILY'
    AND cl.home_type IS DISTINCT FROM 'TOWNHOUSE'
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
    AND cl.home_type IS DISTINCT FROM 'SINGLE_FAMILY'
    AND cl.home_type IS DISTINCT FROM 'TOWNHOUSE'
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
    AND cl.home_type IS DISTINCT FROM 'SINGLE_FAMILY'
    AND cl.home_type IS DISTINCT FROM 'TOWNHOUSE'
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
    AND cl.home_type IS DISTINCT FROM 'SINGLE_FAMILY'
    AND cl.home_type IS DISTINCT FROM 'TOWNHOUSE'
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

-- get_map_rent_trends (ZIP choropleth map)
CREATE OR REPLACE FUNCTION public.get_map_rent_trends(
    p_beds        integer,
    p_weeks_back  integer DEFAULT 13,
    p_reits_only  boolean DEFAULT false
)
RETURNS TABLE (
    zip             text,
    geom_json       text,
    current_median  numeric,
    prior_median    numeric,
    pct_change      numeric,
    listing_count   bigint
)
LANGUAGE sql
SECURITY DEFINER
AS $$
    WITH weekly AS (
        SELECT
            address_zip                                                    AS z,
            DATE_TRUNC('week', scraped_at)::date                           AS week_start,
            PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY price)             AS median_rent,
            COUNT(DISTINCT zpid)                                           AS n
        FROM cleaned_listings
        WHERE price > 500
          AND price < 30000
          AND address_zip IS NOT NULL
          AND scraped_at >= NOW() - (p_weeks_back || ' weeks')::interval
          AND CASE WHEN COALESCE(beds, 0) >= 3 THEN 3 ELSE COALESCE(beds, 0) END = p_beds
          AND home_type IS DISTINCT FROM 'SINGLE_FAMILY'
          AND home_type IS DISTINCT FROM 'TOWNHOUSE'
          AND (
              (p_reits_only     AND building_zpid IS NOT NULL)
           OR (NOT p_reits_only AND building_zpid IS NULL)
          )
        GROUP BY address_zip, week_start
    ),
    ranked AS (
        SELECT
            z,
            median_rent,
            n,
            ROW_NUMBER() OVER (PARTITION BY z ORDER BY week_start DESC) AS rn_desc,
            ROW_NUMBER() OVER (PARTITION BY z ORDER BY week_start ASC)  AS rn_asc,
            COUNT(*)     OVER (PARTITION BY z)                          AS week_count,
            SUM(n)       OVER (PARTITION BY z)                          AS total_n
        FROM weekly
    ),
    current_vals AS (
        SELECT z, median_rent, total_n FROM ranked WHERE rn_desc = 1 AND week_count >= 2
    ),
    prior_vals AS (
        SELECT z, median_rent FROM ranked WHERE rn_asc = 1 AND week_count >= 2
    )
    SELECT
        c.z                                                                     AS zip,
        ST_AsGeoJSON(ST_SimplifyPreserveTopology(zk.geom, 0.001))              AS geom_json,
        c.median_rent                                                           AS current_median,
        p.median_rent                                                           AS prior_median,
        CASE WHEN p.median_rent > 0
            THEN ROUND(((c.median_rent - p.median_rent) / p.median_rent * 100)::numeric, 1)
            ELSE NULL
        END                                                                     AS pct_change,
        c.total_n                                                               AS listing_count
    FROM current_vals  c
    JOIN prior_vals    p  ON c.z  = p.z
    JOIN zip_codes     zk ON c.z  = zk.zip
    WHERE zk.geom IS NOT NULL;
$$;

-- get_map_rent_trends_by_neighborhood (choropleth map)
CREATE OR REPLACE FUNCTION public.get_map_rent_trends_by_neighborhood(
    p_beds        integer,
    p_weeks_back  integer DEFAULT 13,
    p_reits_only  boolean DEFAULT false
)
RETURNS TABLE (
    neighborhood_id  integer,
    name             text,
    city             text,
    geom_json        text,
    current_median   numeric,
    prior_median     numeric,
    pct_change       numeric,
    listing_count    bigint
)
LANGUAGE sql
SECURITY DEFINER
AS $$
    WITH weekly AS (
        SELECT
            n.id                                                               AS nh_id,
            DATE_TRUNC('week', cl.scraped_at)::date                           AS week_start,
            PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY cl.price)             AS median_rent,
            COUNT(DISTINCT cl.zpid)                                           AS cnt
        FROM cleaned_listings cl
        JOIN neighborhoods n ON ST_Within(cl.geom, n.geom)
        WHERE cl.price > 500
          AND cl.price < 30000
          AND cl.geom IS NOT NULL
          AND cl.scraped_at >= NOW() - (p_weeks_back || ' weeks')::interval
          AND CASE WHEN COALESCE(cl.beds, 0) >= 3 THEN 3 ELSE COALESCE(cl.beds, 0) END = p_beds
          AND cl.home_type IS DISTINCT FROM 'SINGLE_FAMILY'
          AND cl.home_type IS DISTINCT FROM 'TOWNHOUSE'
          AND (
              (p_reits_only     AND cl.building_zpid IS NOT NULL)
           OR (NOT p_reits_only AND cl.building_zpid IS NULL)
          )
        GROUP BY n.id, week_start
    ),
    ranked AS (
        SELECT
            nh_id,
            median_rent,
            cnt,
            ROW_NUMBER() OVER (PARTITION BY nh_id ORDER BY week_start DESC) AS rn_desc,
            ROW_NUMBER() OVER (PARTITION BY nh_id ORDER BY week_start ASC)  AS rn_asc,
            COUNT(*)     OVER (PARTITION BY nh_id)                          AS week_count,
            SUM(cnt)     OVER (PARTITION BY nh_id)                          AS total_n
        FROM weekly
    ),
    current_vals AS (
        SELECT nh_id, median_rent, total_n FROM ranked WHERE rn_desc = 1 AND week_count >= 2
    ),
    prior_vals AS (
        SELECT nh_id, median_rent FROM ranked WHERE rn_asc = 1 AND week_count >= 2
    )
    SELECT
        n.id                                                                    AS neighborhood_id,
        n.name::text,
        n.city::text,
        ST_AsGeoJSON(ST_SimplifyPreserveTopology(n.geom, 0.0005))              AS geom_json,
        c.median_rent                                                           AS current_median,
        p.median_rent                                                           AS prior_median,
        CASE WHEN p.median_rent > 0
            THEN ROUND(((c.median_rent - p.median_rent) / p.median_rent * 100)::numeric, 1)
            ELSE NULL
        END                                                                     AS pct_change,
        c.total_n                                                               AS listing_count
    FROM current_vals  c
    JOIN prior_vals    p  ON c.nh_id = p.nh_id
    JOIN neighborhoods n  ON c.nh_id = n.id
    WHERE n.geom IS NOT NULL;
$$;

-- get_map_rent_trends_by_county (choropleth map)
CREATE OR REPLACE FUNCTION public.get_map_rent_trends_by_county(
    p_beds        integer,
    p_weeks_back  integer DEFAULT 13,
    p_reits_only  boolean DEFAULT false
)
RETURNS TABLE (
    county_name   text,
    state         text,
    geom_json     text,
    current_median  numeric,
    prior_median    numeric,
    pct_change      numeric,
    listing_count   bigint
)
LANGUAGE sql
SECURITY DEFINER
AS $$
    WITH weekly AS (
        SELECT
            cb.name                                                            AS county_name,
            cb.state                                                           AS state,
            DATE_TRUNC('week', cl.scraped_at)::date                           AS week_start,
            PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY cl.price)             AS median_rent,
            COUNT(DISTINCT cl.zpid)                                           AS cnt
        FROM cleaned_listings cl
        JOIN county_boundaries cb ON ST_Within(cl.geom, cb.geom)
        WHERE cl.price > 500
          AND cl.price < 30000
          AND cl.geom IS NOT NULL
          AND cl.scraped_at >= NOW() - (p_weeks_back || ' weeks')::interval
          AND CASE WHEN COALESCE(cl.beds, 0) >= 3 THEN 3 ELSE COALESCE(cl.beds, 0) END = p_beds
          AND cl.home_type IS DISTINCT FROM 'SINGLE_FAMILY'
          AND cl.home_type IS DISTINCT FROM 'TOWNHOUSE'
          AND (
              (p_reits_only     AND cl.building_zpid IS NOT NULL)
           OR (NOT p_reits_only AND cl.building_zpid IS NULL)
          )
        GROUP BY cb.name, cb.state, week_start
    ),
    ranked AS (
        SELECT
            county_name,
            state,
            median_rent,
            cnt,
            ROW_NUMBER() OVER (PARTITION BY county_name, state ORDER BY week_start DESC) AS rn_desc,
            ROW_NUMBER() OVER (PARTITION BY county_name, state ORDER BY week_start ASC)  AS rn_asc,
            COUNT(*)     OVER (PARTITION BY county_name, state)                          AS week_count,
            SUM(cnt)     OVER (PARTITION BY county_name, state)                          AS total_n
        FROM weekly
    ),
    current_vals AS (
        SELECT county_name, state, median_rent, total_n FROM ranked WHERE rn_desc = 1 AND week_count >= 2
    ),
    prior_vals AS (
        SELECT county_name, state, median_rent FROM ranked WHERE rn_asc = 1 AND week_count >= 2
    )
    SELECT
        c.county_name,
        c.state,
        ST_AsGeoJSON(ST_SimplifyPreserveTopology(cb.geom, 0.001))              AS geom_json,
        c.median_rent                                                           AS current_median,
        p.median_rent                                                           AS prior_median,
        CASE WHEN p.median_rent > 0
            THEN ROUND(((c.median_rent - p.median_rent) / p.median_rent * 100)::numeric, 1)
            ELSE NULL
        END                                                                     AS pct_change,
        c.total_n                                                               AS listing_count
    FROM current_vals  c
    JOIN prior_vals    p  ON c.county_name = p.county_name AND c.state = p.state
    JOIN county_boundaries cb ON cb.name = c.county_name AND cb.state = c.state
    WHERE cb.geom IS NOT NULL;
$$;

-- get_map_rent_trends_by_msa (choropleth map)
CREATE OR REPLACE FUNCTION public.get_map_rent_trends_by_msa(
    p_beds        integer,
    p_weeks_back  integer DEFAULT 13,
    p_reits_only  boolean DEFAULT false
)
RETURNS TABLE (
    geoid           text,
    name            text,
    geom_json       text,
    current_median  numeric,
    prior_median    numeric,
    pct_change      numeric,
    listing_count   bigint
)
LANGUAGE sql
SECURITY DEFINER
AS $$
    WITH weekly AS (
        SELECT
            mb.geoid                                                           AS geoid,
            DATE_TRUNC('week', cl.scraped_at)::date                           AS week_start,
            PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY cl.price)             AS median_rent,
            COUNT(DISTINCT cl.zpid)                                           AS cnt
        FROM cleaned_listings cl
        JOIN msa_boundaries mb ON ST_Within(cl.geom, mb.geom)
        WHERE cl.price > 500
          AND cl.price < 30000
          AND cl.geom IS NOT NULL
          AND cl.scraped_at >= NOW() - (p_weeks_back || ' weeks')::interval
          AND CASE WHEN COALESCE(cl.beds, 0) >= 3 THEN 3 ELSE COALESCE(cl.beds, 0) END = p_beds
          AND cl.home_type IS DISTINCT FROM 'SINGLE_FAMILY'
          AND cl.home_type IS DISTINCT FROM 'TOWNHOUSE'
          AND (
              (p_reits_only     AND cl.building_zpid IS NOT NULL)
           OR (NOT p_reits_only AND cl.building_zpid IS NULL)
          )
        GROUP BY mb.geoid, week_start
    ),
    ranked AS (
        SELECT
            geoid,
            median_rent,
            cnt,
            ROW_NUMBER() OVER (PARTITION BY geoid ORDER BY week_start DESC) AS rn_desc,
            ROW_NUMBER() OVER (PARTITION BY geoid ORDER BY week_start ASC)  AS rn_asc,
            COUNT(*)     OVER (PARTITION BY geoid)                          AS week_count,
            SUM(cnt)     OVER (PARTITION BY geoid)                          AS total_n
        FROM weekly
    ),
    current_vals AS (
        SELECT geoid, median_rent, total_n FROM ranked WHERE rn_desc = 1 AND week_count >= 2
    ),
    prior_vals AS (
        SELECT geoid, median_rent FROM ranked WHERE rn_asc = 1 AND week_count >= 2
    )
    SELECT
        mb.geoid,
        mb.name::text,
        ST_AsGeoJSON(ST_SimplifyPreserveTopology(mb.geom, 0.005))              AS geom_json,
        c.median_rent                                                           AS current_median,
        p.median_rent                                                           AS prior_median,
        CASE WHEN p.median_rent > 0
            THEN ROUND(((c.median_rent - p.median_rent) / p.median_rent * 100)::numeric, 1)
            ELSE NULL
        END                                                                     AS pct_change,
        c.total_n                                                               AS listing_count
    FROM current_vals  c
    JOIN prior_vals    p  ON c.geoid = p.geoid
    JOIN msa_boundaries mb ON c.geoid = mb.geoid
    WHERE mb.geom IS NOT NULL;
$$;

-- get_map_rent_trends_by_city (choropleth map)
CREATE OR REPLACE FUNCTION public.get_map_rent_trends_by_city(
    p_beds        integer,
    p_weeks_back  integer DEFAULT 13,
    p_reits_only  boolean DEFAULT false
)
RETURNS TABLE (
    city_name       text,
    state           text,
    geom_json       text,
    current_median  numeric,
    prior_median    numeric,
    pct_change      numeric,
    listing_count   bigint
)
LANGUAGE sql
SECURITY DEFINER
AS $$
    WITH weekly AS (
        SELECT
            cb.name                                                            AS city_name,
            cb.state                                                           AS state,
            DATE_TRUNC('week', cl.scraped_at)::date                           AS week_start,
            PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY cl.price)             AS median_rent,
            COUNT(DISTINCT cl.zpid)                                            AS cnt
        FROM city_boundaries cb
        JOIN cleaned_listings cl
            ON lower(cl.address_city)  = lower(cb.name)
            AND lower(cl.address_state) = lower(cb.state)
        WHERE cl.price > 500
          AND cl.price < 30000
          AND cl.scraped_at >= NOW() - (p_weeks_back || ' weeks')::interval
          AND CASE WHEN COALESCE(cl.beds, 0) >= 3 THEN 3 ELSE COALESCE(cl.beds, 0) END = p_beds
          AND cl.home_type IS DISTINCT FROM 'SINGLE_FAMILY'
          AND cl.home_type IS DISTINCT FROM 'TOWNHOUSE'
          AND (
              (p_reits_only     AND cl.building_zpid IS NOT NULL)
           OR (NOT p_reits_only AND cl.building_zpid IS NULL)
          )
        GROUP BY cb.name, cb.state, week_start
    ),
    ranked AS (
        SELECT
            city_name,
            state,
            median_rent,
            cnt,
            ROW_NUMBER() OVER (PARTITION BY city_name, state ORDER BY week_start DESC) AS rn_desc,
            ROW_NUMBER() OVER (PARTITION BY city_name, state ORDER BY week_start ASC)  AS rn_asc,
            COUNT(*)     OVER (PARTITION BY city_name, state)                          AS week_count,
            SUM(cnt)     OVER (PARTITION BY city_name, state)                          AS total_n
        FROM weekly
    ),
    current_vals AS (
        SELECT city_name, state, median_rent, total_n FROM ranked WHERE rn_desc = 1 AND week_count >= 2
    ),
    prior_vals AS (
        SELECT city_name, state, median_rent FROM ranked WHERE rn_asc = 1 AND week_count >= 2
    )
    SELECT
        c.city_name,
        c.state,
        ST_AsGeoJSON(ST_SimplifyPreserveTopology(cb.geom, 0.0001))             AS geom_json,
        c.median_rent                                                            AS current_median,
        p.median_rent                                                            AS prior_median,
        CASE WHEN p.median_rent > 0
            THEN ROUND(((c.median_rent - p.median_rent) / p.median_rent * 100)::numeric, 1)
            ELSE NULL
        END                                                                      AS pct_change,
        c.total_n                                                                AS listing_count
    FROM current_vals  c
    JOIN prior_vals    p  ON c.city_name = p.city_name AND c.state = p.state
    JOIN city_boundaries cb ON cb.name = c.city_name AND cb.state = c.state
    WHERE cb.geom IS NOT NULL;
$$;

-- get_comps
CREATE OR REPLACE FUNCTION public.get_comps(
  subject_lng double precision,
  subject_lat double precision,
  radius_m double precision DEFAULT 3218,
  subject_price integer DEFAULT NULL::integer,
  subject_beds integer DEFAULT NULL::integer,
  subject_baths numeric DEFAULT NULL::numeric,
  subject_area integer DEFAULT NULL::integer,
  p_limit integer DEFAULT 10,
  p_segment text DEFAULT 'both',
  p_neighborhood_id integer DEFAULT NULL::integer,
  p_subject_zip text DEFAULT NULL::text,
  p_expand_adjacent boolean DEFAULT false,
  p_neighborhood_ids integer[] DEFAULT NULL::integer[],
  p_home_type text DEFAULT NULL::text
)
 RETURNS TABLE(id uuid, address_raw text, address_street text, address_city text, address_state text, address_zip text, price integer, beds integer, baths numeric, area integer, distance_m double precision, composite_score double precision, building_zpid text, unit_count integer)
 LANGUAGE sql
AS $function$
  WITH neighborhood_geom AS (
    SELECT
      CASE
        WHEN p_expand_adjacent AND p_neighborhood_id IS NOT NULL THEN (
          SELECT ST_Union(n.geom)
          FROM neighborhoods n
          WHERE ST_DWithin(
            n.geom::geography,
            (SELECT geom FROM neighborhoods WHERE id = p_neighborhood_id)::geography,
            100
          )
        )
        ELSE (SELECT geom FROM neighborhoods WHERE id = p_neighborhood_id)
      END AS geom
  ),
  prefiltered AS (
    SELECT cl.*
    FROM cleaned_listings cl
    WHERE cl.geom IS NOT NULL
      AND cl.price IS NOT NULL
      AND cl.is_building IS NOT TRUE
      AND cl.home_type IS DISTINCT FROM 'SINGLE_FAMILY'
      AND cl.home_type IS DISTINCT FROM 'TOWNHOUSE'
      AND (p_home_type IS NULL OR cl.home_type = p_home_type)
      AND (
        p_segment = 'both'
        OR (p_segment = 'mid' AND cl.building_zpid IS NULL)
        OR (p_segment = 'reit' AND cl.building_zpid IS NOT NULL)
      )
      AND (
        (
          p_neighborhood_ids IS NOT NULL
          AND ST_Within(cl.geom, (SELECT ST_Union(geom) FROM neighborhoods WHERE id = ANY(p_neighborhood_ids)))
        )
        OR (
          p_neighborhood_ids IS NULL
          AND p_neighborhood_id IS NOT NULL
          AND ST_Within(cl.geom, (SELECT geom FROM neighborhood_geom))
        )
        OR (
          p_neighborhood_ids IS NULL
          AND p_neighborhood_id IS NULL
          AND p_subject_zip IS NOT NULL
          AND cl.address_zip = p_subject_zip
        )
        OR (
          p_neighborhood_ids IS NULL
          AND p_neighborhood_id IS NULL
          AND p_subject_zip IS NULL
          AND ST_DWithin(
            ST_SetSRID(ST_Point(subject_lng, subject_lat), 4326)::geography,
            cl.geom::geography,
            radius_m
          )
        )
      )
  ),
  deduped AS (
    SELECT DISTINCT ON (zpid)
      id, address_raw, address_street, address_city, address_state, address_zip,
      price, beds, baths, area, building_zpid, geom, home_type, is_building
    FROM prefiltered
    ORDER BY zpid, scraped_at DESC NULLS LAST
  ),
  candidates AS (
    SELECT
      cl.id,
      cl.address_raw,
      cl.address_street,
      cl.address_city,
      cl.address_state,
      cl.address_zip,
      cl.price,
      COALESCE(cl.beds, 0) AS beds,
      cl.baths,
      cl.area,
      cl.building_zpid,
      ST_Distance(
        ST_SetSRID(ST_Point(subject_lng, subject_lat), 4326)::geography,
        cl.geom::geography
      ) AS distance_m
    FROM deduped cl
    WHERE (subject_beds IS NULL OR COALESCE(cl.beds, 0) = subject_beds)
  ),
  scored AS (
    SELECT
      *,
      1.0 / (1.0 + distance_m / 1000.0) AS dist_score,
      CASE
        WHEN subject_price IS NOT NULL AND price > 0
        THEN 1.0 / (1.0 + ABS(LN(GREATEST(subject_price, 1)::float / GREATEST(price, 1)::float)))
      END AS price_score,
      CASE
        WHEN subject_baths IS NOT NULL AND baths IS NOT NULL
        THEN CASE
               WHEN ABS(subject_baths::float - baths::float) < 0.5 THEN 1.0
               WHEN ABS(subject_baths::float - baths::float) < 1.5 THEN 0.5
               ELSE 0.25
             END
      END AS baths_score,
      CASE
        WHEN subject_area IS NOT NULL AND area IS NOT NULL AND subject_area > 0
        THEN 1.0 / (1.0 + ABS(subject_area::float - area::float) / subject_area::float)
      END AS area_score
    FROM candidates
    WHERE distance_m > 10
  ),
  weighted AS (
    SELECT
      *,
      0.05                                                            AS w_dist,
      CASE WHEN price_score IS NOT NULL THEN 0.60 ELSE 0 END           AS w_price,
      CASE WHEN baths_score IS NOT NULL THEN 0.20 ELSE 0 END           AS w_baths,
      CASE WHEN area_score  IS NOT NULL THEN 0.15 ELSE 0 END           AS w_area
    FROM scored
  ),
  final_scored AS (
    SELECT
      *,
      CASE
        WHEN (w_price + w_baths + w_area) = 0
        THEN dist_score
        ELSE (
          w_dist  * dist_score  +
          w_price * COALESCE(price_score, 0) +
          w_baths * COALESCE(baths_score, 0) +
          w_area  * COALESCE(area_score,  0)
        ) / (w_dist + w_price + w_baths + w_area)
      END AS composite_score
    FROM weighted
  ),
  non_reit AS (
    SELECT
      id, address_raw, address_street, address_city, address_state, address_zip,
      price, beds, baths, area, distance_m, composite_score, building_zpid,
      1::integer AS unit_count
    FROM final_scored
    WHERE building_zpid IS NULL
  ),
  reit_agg AS (
    SELECT
      (array_agg(id ORDER BY price))[1]             AS id,
      (array_agg(address_raw ORDER BY price))[1]    AS address_raw,
      (array_agg(address_street ORDER BY price))[1] AS address_street,
      (array_agg(address_city ORDER BY price))[1]   AS address_city,
      (array_agg(address_state ORDER BY price))[1]  AS address_state,
      (array_agg(address_zip ORDER BY price))[1]    AS address_zip,
      ROUND(AVG(price))::integer                    AS price,
      beds,
      baths,
      ROUND(AVG(area))::integer                     AS area,
      MIN(distance_m)                               AS distance_m,
      AVG(composite_score)                          AS composite_score,
      building_zpid,
      COUNT(*)::integer                             AS unit_count
    FROM final_scored
    WHERE building_zpid IS NOT NULL
    GROUP BY building_zpid, beds, baths
  )
  SELECT * FROM non_reit
  UNION ALL
  SELECT * FROM reit_agg
  ORDER BY composite_score DESC
  LIMIT p_limit;
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
GRANT EXECUTE ON FUNCTION public.get_map_rent_trends(integer, integer, boolean) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_map_rent_trends_by_neighborhood(integer, integer, boolean) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_map_rent_trends_by_county(integer, integer, boolean) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_map_rent_trends_by_msa(integer, integer, boolean) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_map_rent_trends_by_city(integer, integer, boolean) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_comps(double precision, double precision, double precision, integer, integer, numeric, integer, integer, text, integer, text, boolean, integer[], text) TO anon, authenticated;
