-- Soft-exclude duplicate parcel lines from split portfolio sales in Crexi trends.
--
-- Rules (one-time backfill + RPC filter):
--   • Assign each comp to a county via ST_Within (geom, or lon/lat point).
--   • Calendar year + county: if at least 30 raw sales-comp rows, compute Tukey
--     upper fence on per-row price/door (property_price_total / num_units).
--   • If fewer than 30 rows in that county-year, do nothing for that cohort.
--   • Candidate split groups: same county, calendar year, sale date, price,
--     sale_seller, sale_buyer, with COUNT(*) > 1.
--   • Merge only when MAX(per-row price/door) in that group exceeds the fence:
--     keep MIN(id) row: set num_units = SUM(num_units) across the group;
--     set exclude_from_sales_trends = true on all other rows in the group.
--
-- All Crexi sales-trend RPCs (time-series + map) filter exclude_from_sales_trends.

ALTER TABLE public.crexi_api_comps
    ADD COLUMN IF NOT EXISTS exclude_from_sales_trends boolean NOT NULL DEFAULT false;

-- One-off: merge split-deal parcel rows where county-year IQR applies.
WITH located AS (
    SELECT DISTINCT ON (c.id)
        c.id,
        EXTRACT(YEAR FROM c.sale_transaction_date::date)::integer AS sale_yr,
        c.sale_transaction_date::date AS sale_dt,
        c.property_price_total AS price,
        c.sale_seller,
        c.sale_buyer,
        c.num_units,
        c.property_price_total / c.num_units::numeric AS ppd,
        cb.name_lsad AS county_lsad,
        cb.state AS county_state
    FROM public.crexi_api_comps c
    JOIN public.county_boundaries cb
        ON ST_Within(
            COALESCE(c.geom, ST_SetSRID(ST_Point(c.longitude, c.latitude), 4326)),
            cb.geom
        )
    WHERE c.is_sales_comp = true
      AND c.property_price_total IS NOT NULL AND c.property_price_total > 0
      AND c.num_units IS NOT NULL AND c.num_units > 0
      AND c.sale_transaction_date IS NOT NULL
      AND (
          c.geom IS NOT NULL
          OR (c.longitude IS NOT NULL AND c.latitude IS NOT NULL)
      )
    ORDER BY c.id, cb.name_lsad
),
fence AS (
    SELECT
        county_lsad,
        county_state,
        sale_yr,
        PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY ppd) AS q1,
        PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY ppd) AS q3
    FROM located
    GROUP BY county_lsad, county_state, sale_yr
    HAVING COUNT(*) >= 30
),
fence2 AS (
    SELECT
        county_lsad,
        county_state,
        sale_yr,
        q3 + 1.5 * (q3 - q1) AS upper_fence
    FROM fence
),
grp AS (
    SELECT
        l.*,
        COUNT(*) OVER (
            PARTITION BY county_lsad, county_state, sale_yr, sale_dt, price, sale_seller, sale_buyer
        ) AS gsize,
        MAX(ppd) OVER (
            PARTITION BY county_lsad, county_state, sale_yr, sale_dt, price, sale_seller, sale_buyer
        ) AS gmax_ppd,
        MIN(id) OVER (
            PARTITION BY county_lsad, county_state, sale_yr, sale_dt, price, sale_seller, sale_buyer
        ) AS keeper_id,
        SUM(num_units) OVER (
            PARTITION BY county_lsad, county_state, sale_yr, sale_dt, price, sale_seller, sale_buyer
        ) AS sum_units
    FROM located l
),
to_merge AS (
    SELECT g.*
    FROM grp g
    JOIN fence2 f
        ON f.county_lsad = g.county_lsad
        AND f.county_state = g.county_state
        AND f.sale_yr = g.sale_yr
    WHERE g.gsize > 1
      AND g.gmax_ppd > f.upper_fence
),
keeper AS (
    SELECT DISTINCT keeper_id, sum_units::integer AS new_num_units
    FROM to_merge
    WHERE id = keeper_id
)
UPDATE public.crexi_api_comps c
SET num_units = k.new_num_units
FROM keeper k
WHERE c.id = k.keeper_id;

WITH located AS (
    SELECT DISTINCT ON (c.id)
        c.id,
        EXTRACT(YEAR FROM c.sale_transaction_date::date)::integer AS sale_yr,
        c.sale_transaction_date::date AS sale_dt,
        c.property_price_total AS price,
        c.sale_seller,
        c.sale_buyer,
        c.num_units,
        c.property_price_total / c.num_units::numeric AS ppd,
        cb.name_lsad AS county_lsad,
        cb.state AS county_state
    FROM public.crexi_api_comps c
    JOIN public.county_boundaries cb
        ON ST_Within(
            COALESCE(c.geom, ST_SetSRID(ST_Point(c.longitude, c.latitude), 4326)),
            cb.geom
        )
    WHERE c.is_sales_comp = true
      AND c.property_price_total IS NOT NULL AND c.property_price_total > 0
      AND c.num_units IS NOT NULL AND c.num_units > 0
      AND c.sale_transaction_date IS NOT NULL
      AND (
          c.geom IS NOT NULL
          OR (c.longitude IS NOT NULL AND c.latitude IS NOT NULL)
      )
    ORDER BY c.id, cb.name_lsad
),
fence AS (
    SELECT
        county_lsad,
        county_state,
        sale_yr,
        PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY ppd) AS q1,
        PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY ppd) AS q3
    FROM located
    GROUP BY county_lsad, county_state, sale_yr
    HAVING COUNT(*) >= 30
),
fence2 AS (
    SELECT
        county_lsad,
        county_state,
        sale_yr,
        q3 + 1.5 * (q3 - q1) AS upper_fence
    FROM fence
),
grp AS (
    SELECT
        l.*,
        COUNT(*) OVER (
            PARTITION BY county_lsad, county_state, sale_yr, sale_dt, price, sale_seller, sale_buyer
        ) AS gsize,
        MAX(ppd) OVER (
            PARTITION BY county_lsad, county_state, sale_yr, sale_dt, price, sale_seller, sale_buyer
        ) AS gmax_ppd,
        MIN(id) OVER (
            PARTITION BY county_lsad, county_state, sale_yr, sale_dt, price, sale_seller, sale_buyer
        ) AS keeper_id
    FROM located l
),
dup AS (
    SELECT g.id
    FROM grp g
    JOIN fence2 f
        ON f.county_lsad = g.county_lsad
        AND f.county_state = g.county_state
        AND f.sale_yr = g.sale_yr
    WHERE g.gsize > 1
      AND g.gmax_ppd > f.upper_fence
      AND g.id <> g.keeper_id
)
UPDATE public.crexi_api_comps c
SET exclude_from_sales_trends = true
FROM dup d
WHERE c.id = d.id;

-- ══════════════════════════════════════════════════════════════════════════════
-- Crexi sales-trend RPCs: exclude soft-flagged duplicate parcel lines
-- ══════════════════════════════════════════════════════════════════════════════

-- ── Time-series v1 (price per door) ─────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_crexi_sales_trends(
  p_zip text DEFAULT NULL
)
RETURNS TABLE(month_start date, median_price numeric, avg_cap_rate numeric, listing_count bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
AS $function$
  SELECT
    DATE_TRUNC('month', sale_transaction_date::date)::date AS month_start,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY property_price_total / num_units::numeric)::numeric AS median_price,
    AVG(COALESCE(sale_cap_rate_percent, financials_cap_rate_percent)) AS avg_cap_rate,
    COUNT(*) AS listing_count
  FROM crexi_api_comps
  WHERE
    is_sales_comp = true
    AND NOT exclude_from_sales_trends
    AND property_price_total IS NOT NULL AND property_price_total > 0
    AND num_units IS NOT NULL AND num_units > 0
    AND sale_transaction_date IS NOT NULL
    AND (p_zip IS NULL OR zip = p_zip)
  GROUP BY 1
  ORDER BY 1;
$function$;

CREATE OR REPLACE FUNCTION public.get_crexi_sales_trends_by_city(
  p_city text,
  p_state text
)
RETURNS TABLE(month_start date, median_price numeric, avg_cap_rate numeric, listing_count bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
AS $function$
  SELECT
    DATE_TRUNC('month', sale_transaction_date::date)::date AS month_start,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY property_price_total / num_units::numeric)::numeric AS median_price,
    AVG(COALESCE(sale_cap_rate_percent, financials_cap_rate_percent)) AS avg_cap_rate,
    COUNT(*) AS listing_count
  FROM crexi_api_comps
  WHERE
    is_sales_comp = true
    AND NOT exclude_from_sales_trends
    AND property_price_total IS NOT NULL AND property_price_total > 0
    AND num_units IS NOT NULL AND num_units > 0
    AND sale_transaction_date IS NOT NULL
    AND city ILIKE p_city
    AND state ILIKE p_state
  GROUP BY 1
  ORDER BY 1;
$function$;

CREATE OR REPLACE FUNCTION public.get_crexi_sales_trends_by_county(
  p_county_name text,
  p_state text
)
RETURNS TABLE(month_start date, median_price numeric, avg_cap_rate numeric, listing_count bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
AS $function$
  SELECT
    DATE_TRUNC('month', c.sale_transaction_date::date)::date AS month_start,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY c.property_price_total / c.num_units::numeric)::numeric AS median_price,
    AVG(COALESCE(c.sale_cap_rate_percent, c.financials_cap_rate_percent)) AS avg_cap_rate,
    COUNT(*) AS listing_count
  FROM crexi_api_comps c
  JOIN county_boundaries cb
    ON ST_Within(c.geom, cb.geom)
  WHERE
    c.is_sales_comp = true
    AND NOT c.exclude_from_sales_trends
    AND c.property_price_total IS NOT NULL AND c.property_price_total > 0
    AND c.num_units IS NOT NULL AND c.num_units > 0
    AND c.sale_transaction_date IS NOT NULL
    AND c.geom IS NOT NULL
    AND cb.name_lsad ILIKE p_county_name
    AND cb.state = p_state
  GROUP BY 1
  ORDER BY 1;
$function$;

CREATE OR REPLACE FUNCTION public.get_crexi_sales_trends_by_neighborhood(
  p_neighborhood_ids integer[]
)
RETURNS TABLE(month_start date, median_price numeric, avg_cap_rate numeric, listing_count bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
AS $function$
  SELECT
    DATE_TRUNC('month', c.sale_transaction_date::date)::date AS month_start,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY c.property_price_total / c.num_units::numeric)::numeric AS median_price,
    AVG(COALESCE(c.sale_cap_rate_percent, c.financials_cap_rate_percent)) AS avg_cap_rate,
    COUNT(*) AS listing_count
  FROM crexi_api_comps c
  JOIN neighborhoods n
    ON ST_Within(c.geom, n.geom)
  WHERE
    c.is_sales_comp = true
    AND NOT c.exclude_from_sales_trends
    AND c.property_price_total IS NOT NULL AND c.property_price_total > 0
    AND c.num_units IS NOT NULL AND c.num_units > 0
    AND c.sale_transaction_date IS NOT NULL
    AND c.geom IS NOT NULL
    AND n.id = ANY(p_neighborhood_ids)
  GROUP BY 1
  ORDER BY 1;
$function$;

CREATE OR REPLACE FUNCTION public.get_crexi_sales_trends_by_msa(
  p_geoid text
)
RETURNS TABLE(month_start date, median_price numeric, avg_cap_rate numeric, listing_count bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
AS $function$
  SELECT
    DATE_TRUNC('month', c.sale_transaction_date::date)::date AS month_start,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY c.property_price_total / c.num_units::numeric)::numeric AS median_price,
    AVG(COALESCE(c.sale_cap_rate_percent, c.financials_cap_rate_percent)) AS avg_cap_rate,
    COUNT(*) AS listing_count
  FROM crexi_api_comps c
  JOIN msa_boundaries mb
    ON ST_Within(c.geom, mb.geom)
  WHERE
    c.is_sales_comp = true
    AND NOT c.exclude_from_sales_trends
    AND c.property_price_total IS NOT NULL AND c.property_price_total > 0
    AND c.num_units IS NOT NULL AND c.num_units > 0
    AND c.sale_transaction_date IS NOT NULL
    AND c.geom IS NOT NULL
    AND mb.geoid = p_geoid
  GROUP BY 1
  ORDER BY 1;
$function$;

-- ── Time-series v2 ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_crexi_sales_trends_v2(
  p_zip        text    DEFAULT NULL,
  p_min_units  integer DEFAULT NULL,
  p_max_units  integer DEFAULT NULL
)
RETURNS TABLE(
  month_start   date,
  median_price  numeric,
  avg_price     numeric,
  p25_price     numeric,
  p75_price     numeric,
  avg_cap_rate  numeric,
  listing_count bigint
)
LANGUAGE sql
STABLE SECURITY DEFINER
AS $function$
  SELECT
    DATE_TRUNC('month', sale_transaction_date::date)::date AS month_start,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY property_price_total / num_units::numeric)::numeric AS median_price,
    AVG(property_price_total / num_units::numeric)::numeric AS avg_price,
    PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY property_price_total / num_units::numeric)::numeric AS p25_price,
    PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY property_price_total / num_units::numeric)::numeric AS p75_price,
    AVG(COALESCE(sale_cap_rate_percent, financials_cap_rate_percent)) AS avg_cap_rate,
    COUNT(*) AS listing_count
  FROM crexi_api_comps
  WHERE
    is_sales_comp = true
    AND NOT exclude_from_sales_trends
    AND property_price_total IS NOT NULL AND property_price_total > 0
    AND num_units IS NOT NULL AND num_units > 0
    AND sale_transaction_date IS NOT NULL
    AND (p_zip IS NULL OR zip = p_zip)
    AND (p_min_units IS NULL OR num_units >= p_min_units)
    AND (p_max_units IS NULL OR num_units <= p_max_units)
  GROUP BY 1
  ORDER BY 1;
$function$;

CREATE OR REPLACE FUNCTION public.get_crexi_sales_trends_by_city_v2(
  p_city       text,
  p_state      text,
  p_min_units  integer DEFAULT NULL,
  p_max_units  integer DEFAULT NULL
)
RETURNS TABLE(
  month_start   date,
  median_price  numeric,
  avg_price     numeric,
  p25_price     numeric,
  p75_price     numeric,
  avg_cap_rate  numeric,
  listing_count bigint
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET statement_timeout = '120s'
AS $function$
  SELECT
    DATE_TRUNC('month', sale_transaction_date::date)::date AS month_start,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY property_price_total / num_units::numeric)::numeric AS median_price,
    AVG(property_price_total / num_units::numeric)::numeric AS avg_price,
    PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY property_price_total / num_units::numeric)::numeric AS p25_price,
    PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY property_price_total / num_units::numeric)::numeric AS p75_price,
    AVG(COALESCE(sale_cap_rate_percent, financials_cap_rate_percent)) AS avg_cap_rate,
    COUNT(*) AS listing_count
  FROM crexi_api_comps
  WHERE
    is_sales_comp = true
    AND NOT exclude_from_sales_trends
    AND property_price_total IS NOT NULL AND property_price_total > 0
    AND num_units IS NOT NULL AND num_units > 0
    AND sale_transaction_date IS NOT NULL
    AND city ILIKE p_city
    AND state ILIKE p_state
    AND (p_min_units IS NULL OR num_units >= p_min_units)
    AND (p_max_units IS NULL OR num_units <= p_max_units)
  GROUP BY 1
  ORDER BY 1;
$function$;

CREATE OR REPLACE FUNCTION public.get_crexi_sales_trends_by_county_v2(
  p_county_name text,
  p_state       text,
  p_min_units   integer DEFAULT NULL,
  p_max_units   integer DEFAULT NULL
)
RETURNS TABLE(
  month_start   date,
  median_price  numeric,
  avg_price     numeric,
  p25_price     numeric,
  p75_price     numeric,
  avg_cap_rate  numeric,
  listing_count bigint
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET statement_timeout = '120s'
AS $function$
  SELECT
    DATE_TRUNC('month', c.sale_transaction_date::date)::date AS month_start,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY c.property_price_total / c.num_units::numeric)::numeric AS median_price,
    AVG(c.property_price_total / c.num_units::numeric)::numeric AS avg_price,
    PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY c.property_price_total / c.num_units::numeric)::numeric AS p25_price,
    PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY c.property_price_total / c.num_units::numeric)::numeric AS p75_price,
    AVG(COALESCE(c.sale_cap_rate_percent, c.financials_cap_rate_percent)) AS avg_cap_rate,
    COUNT(*) AS listing_count
  FROM crexi_api_comps c
  JOIN county_boundaries cb
    ON ST_Within(ST_SetSRID(ST_Point(c.longitude, c.latitude), 4326), cb.geom)
  WHERE
    c.is_sales_comp = true
    AND NOT c.exclude_from_sales_trends
    AND c.property_price_total IS NOT NULL AND c.property_price_total > 0
    AND c.num_units IS NOT NULL AND c.num_units > 0
    AND c.sale_transaction_date IS NOT NULL
    AND c.latitude IS NOT NULL AND c.longitude IS NOT NULL
    AND cb.name_lsad ILIKE p_county_name
    AND cb.state = p_state
    AND (p_min_units IS NULL OR c.num_units >= p_min_units)
    AND (p_max_units IS NULL OR c.num_units <= p_max_units)
  GROUP BY 1
  ORDER BY 1;
$function$;

CREATE OR REPLACE FUNCTION public.get_crexi_sales_trends_by_neighborhood_v2(
  p_neighborhood_ids integer[],
  p_min_units        integer DEFAULT NULL,
  p_max_units        integer DEFAULT NULL
)
RETURNS TABLE(
  month_start   date,
  median_price  numeric,
  avg_price     numeric,
  p25_price     numeric,
  p75_price     numeric,
  avg_cap_rate  numeric,
  listing_count bigint
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET statement_timeout = '120s'
AS $function$
  SELECT
    DATE_TRUNC('month', c.sale_transaction_date::date)::date AS month_start,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY c.property_price_total / c.num_units::numeric)::numeric AS median_price,
    AVG(c.property_price_total / c.num_units::numeric)::numeric AS avg_price,
    PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY c.property_price_total / c.num_units::numeric)::numeric AS p25_price,
    PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY c.property_price_total / c.num_units::numeric)::numeric AS p75_price,
    AVG(COALESCE(c.sale_cap_rate_percent, c.financials_cap_rate_percent)) AS avg_cap_rate,
    COUNT(*) AS listing_count
  FROM crexi_api_comps c
  JOIN neighborhoods n
    ON ST_Within(ST_SetSRID(ST_Point(c.longitude, c.latitude), 4326), n.geom)
  WHERE
    c.is_sales_comp = true
    AND NOT c.exclude_from_sales_trends
    AND c.property_price_total IS NOT NULL AND c.property_price_total > 0
    AND c.num_units IS NOT NULL AND c.num_units > 0
    AND c.sale_transaction_date IS NOT NULL
    AND c.latitude IS NOT NULL AND c.longitude IS NOT NULL
    AND n.id = ANY(p_neighborhood_ids)
    AND (p_min_units IS NULL OR c.num_units >= p_min_units)
    AND (p_max_units IS NULL OR c.num_units <= p_max_units)
  GROUP BY 1
  ORDER BY 1;
$function$;

CREATE OR REPLACE FUNCTION public.get_crexi_sales_trends_by_msa_v2(
  p_geoid      text,
  p_min_units  integer DEFAULT NULL,
  p_max_units  integer DEFAULT NULL
)
RETURNS TABLE(
  month_start   date,
  median_price  numeric,
  avg_price     numeric,
  p25_price     numeric,
  p75_price     numeric,
  avg_cap_rate  numeric,
  listing_count bigint
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET statement_timeout = '120s'
AS $function$
  SELECT
    DATE_TRUNC('month', c.sale_transaction_date::date)::date AS month_start,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY c.property_price_total / c.num_units::numeric)::numeric AS median_price,
    AVG(c.property_price_total / c.num_units::numeric)::numeric AS avg_price,
    PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY c.property_price_total / c.num_units::numeric)::numeric AS p25_price,
    PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY c.property_price_total / c.num_units::numeric)::numeric AS p75_price,
    AVG(COALESCE(c.sale_cap_rate_percent, c.financials_cap_rate_percent)) AS avg_cap_rate,
    COUNT(*) AS listing_count
  FROM crexi_api_comps c
  JOIN msa_boundaries mb
    ON ST_Within(ST_SetSRID(ST_Point(c.longitude, c.latitude), 4326), mb.geom)
  WHERE
    c.is_sales_comp = true
    AND NOT c.exclude_from_sales_trends
    AND c.property_price_total IS NOT NULL AND c.property_price_total > 0
    AND c.num_units IS NOT NULL AND c.num_units > 0
    AND c.sale_transaction_date IS NOT NULL
    AND c.latitude IS NOT NULL AND c.longitude IS NOT NULL
    AND mb.geoid = p_geoid
    AND (p_min_units IS NULL OR c.num_units >= p_min_units)
    AND (p_max_units IS NULL OR c.num_units <= p_max_units)
  GROUP BY 1
  ORDER BY 1;
$function$;

-- ── Map choropleth (Crexi) ───────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_map_crexi_sales_trends(
    p_months_back integer DEFAULT 12
)
RETURNS TABLE(
    zip            text,
    geom_json      text,
    current_median numeric,
    prior_median   numeric,
    pct_change     numeric,
    listing_count  bigint
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET statement_timeout = '30s'
AS $function$
WITH bounds AS (
    SELECT
        (NOW()::date - (p_months_back || ' months')::interval)::date AS window_start,
        (NOW()::date - (p_months_back / 2 || ' months')::interval)::date AS midpoint
),
combined AS (
    SELECT
        LEFT(c.zip, 5)                                                             AS z,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY c.property_price_total / c.num_units::numeric)
            FILTER (WHERE c.sale_transaction_date::date <  b.midpoint)             AS prior_median,
        COUNT(*) FILTER (WHERE c.sale_transaction_date::date <  b.midpoint)        AS prior_cnt,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY c.property_price_total / c.num_units::numeric)
            FILTER (WHERE c.sale_transaction_date::date >= b.midpoint)             AS current_median,
        COUNT(*) FILTER (WHERE c.sale_transaction_date::date >= b.midpoint)        AS current_cnt,
        COUNT(*)                                                                    AS total_n
    FROM crexi_api_comps c
    CROSS JOIN bounds b
    WHERE c.is_sales_comp = true
      AND NOT c.exclude_from_sales_trends
      AND c.property_price_total IS NOT NULL AND c.property_price_total > 0
      AND c.num_units IS NOT NULL AND c.num_units > 0
      AND c.sale_transaction_date IS NOT NULL
      AND c.zip IS NOT NULL AND LENGTH(c.zip) >= 5
      AND c.sale_transaction_date::date >= b.window_start
    GROUP BY LEFT(c.zip, 5)
)
SELECT
    c.z                                                                            AS zip,
    ST_AsGeoJSON(ST_SimplifyPreserveTopology(zk.geom, 0.001))                     AS geom_json,
    c.current_median,
    c.prior_median,
    CASE WHEN c.prior_cnt >= 2 AND c.current_cnt >= 2 AND c.prior_median > 0
        THEN ROUND(((c.current_median - c.prior_median) / c.prior_median * 100)::numeric, 1)
        ELSE NULL
    END                                                                            AS pct_change,
    c.total_n                                                                      AS listing_count
FROM combined c
JOIN zip_codes zk ON c.z = zk.zip
WHERE zk.geom IS NOT NULL
  AND c.prior_cnt >= 2
  AND c.current_cnt >= 2;
$function$;

CREATE OR REPLACE FUNCTION public.get_map_crexi_sales_trends_by_neighborhood(
    p_months_back integer DEFAULT 12
)
RETURNS TABLE(
    neighborhood_id integer,
    name           text,
    city           text,
    geom_json      text,
    current_median numeric,
    prior_median   numeric,
    pct_change     numeric,
    listing_count  bigint
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET statement_timeout = '30s'
AS $function$
WITH bounds AS (
    SELECT
        (NOW()::date - (p_months_back || ' months')::interval)::date AS window_start,
        (NOW()::date - (p_months_back / 2 || ' months')::interval)::date AS midpoint
),
combined AS (
    SELECT
        n.id                                                                       AS nh_id,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY c.property_price_total / c.num_units::numeric)
            FILTER (WHERE c.sale_transaction_date::date <  b.midpoint)             AS prior_median,
        COUNT(*) FILTER (WHERE c.sale_transaction_date::date <  b.midpoint)        AS prior_cnt,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY c.property_price_total / c.num_units::numeric)
            FILTER (WHERE c.sale_transaction_date::date >= b.midpoint)             AS current_median,
        COUNT(*) FILTER (WHERE c.sale_transaction_date::date >= b.midpoint)        AS current_cnt,
        COUNT(*)                                                                    AS total_n
    FROM crexi_api_comps c
    JOIN neighborhoods n ON ST_Within(c.geom, n.geom)
    CROSS JOIN bounds b
    WHERE c.is_sales_comp = true
      AND NOT c.exclude_from_sales_trends
      AND c.property_price_total IS NOT NULL AND c.property_price_total > 0
      AND c.num_units IS NOT NULL AND c.num_units > 0
      AND c.sale_transaction_date IS NOT NULL
      AND c.geom IS NOT NULL
      AND c.sale_transaction_date::date >= b.window_start
    GROUP BY n.id
)
SELECT
    n.id                                                                           AS neighborhood_id,
    n.name::text,
    n.city::text,
    ST_AsGeoJSON(ST_SimplifyPreserveTopology(n.geom, 0.0005))                     AS geom_json,
    c.current_median,
    c.prior_median,
    CASE WHEN c.prior_cnt >= 2 AND c.current_cnt >= 2 AND c.prior_median > 0
        THEN ROUND(((c.current_median - c.prior_median) / c.prior_median * 100)::numeric, 1)
        ELSE NULL
    END                                                                            AS pct_change,
    c.total_n                                                                      AS listing_count
FROM combined c
JOIN neighborhoods n ON c.nh_id = n.id
WHERE n.geom IS NOT NULL
  AND c.prior_cnt >= 2
  AND c.current_cnt >= 2;
$function$;

CREATE OR REPLACE FUNCTION public.get_map_crexi_sales_trends_by_city(
    p_months_back integer DEFAULT 12
)
RETURNS TABLE(
    city_name      text,
    state          text,
    geom_json      text,
    current_median numeric,
    prior_median   numeric,
    pct_change     numeric,
    listing_count  bigint
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET statement_timeout = '30s'
AS $function$
WITH bounds AS (
    SELECT
        (NOW()::date - (p_months_back || ' months')::interval)::date AS window_start,
        (NOW()::date - (p_months_back / 2 || ' months')::interval)::date AS midpoint
),
combined AS (
    SELECT
        cb.name                                                                    AS city_name,
        cb.state,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY c.property_price_total / c.num_units::numeric)
            FILTER (WHERE c.sale_transaction_date::date <  b.midpoint)             AS prior_median,
        COUNT(*) FILTER (WHERE c.sale_transaction_date::date <  b.midpoint)        AS prior_cnt,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY c.property_price_total / c.num_units::numeric)
            FILTER (WHERE c.sale_transaction_date::date >= b.midpoint)             AS current_median,
        COUNT(*) FILTER (WHERE c.sale_transaction_date::date >= b.midpoint)        AS current_cnt,
        COUNT(*)                                                                    AS total_n
    FROM crexi_api_comps c
    JOIN city_boundaries cb
        ON lower(c.city)  = lower(cb.name)
        AND lower(c.state) = lower(cb.state)
    CROSS JOIN bounds b
    WHERE c.is_sales_comp = true
      AND NOT c.exclude_from_sales_trends
      AND c.property_price_total IS NOT NULL AND c.property_price_total > 0
      AND c.num_units IS NOT NULL AND c.num_units > 0
      AND c.sale_transaction_date IS NOT NULL
      AND c.city IS NOT NULL
      AND c.sale_transaction_date::date >= b.window_start
    GROUP BY cb.name, cb.state
)
SELECT
    c.city_name,
    c.state,
    ST_AsGeoJSON(ST_SimplifyPreserveTopology(cb.geom, 0.0001))                    AS geom_json,
    c.current_median,
    c.prior_median,
    CASE WHEN c.prior_cnt >= 2 AND c.current_cnt >= 2 AND c.prior_median > 0
        THEN ROUND(((c.current_median - c.prior_median) / c.prior_median * 100)::numeric, 1)
        ELSE NULL
    END                                                                            AS pct_change,
    c.total_n                                                                      AS listing_count
FROM combined c
JOIN city_boundaries cb ON cb.name = c.city_name AND cb.state = c.state
WHERE cb.geom IS NOT NULL
  AND c.prior_cnt >= 2
  AND c.current_cnt >= 2;
$function$;

CREATE OR REPLACE FUNCTION public.get_map_crexi_sales_trends_by_county(
    p_months_back integer DEFAULT 12
)
RETURNS TABLE(
    county_name    text,
    state          text,
    geom_json      text,
    current_median numeric,
    prior_median   numeric,
    pct_change     numeric,
    listing_count  bigint
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET statement_timeout = '30s'
AS $function$
WITH bounds AS (
    SELECT
        (NOW()::date - (p_months_back || ' months')::interval)::date AS window_start,
        (NOW()::date - (p_months_back / 2 || ' months')::interval)::date AS midpoint
),
combined AS (
    SELECT
        cb.name_lsad                                                               AS county_name,
        cb.state,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY c.property_price_total / c.num_units::numeric)
            FILTER (WHERE c.sale_transaction_date::date <  b.midpoint)             AS prior_median,
        COUNT(*) FILTER (WHERE c.sale_transaction_date::date <  b.midpoint)        AS prior_cnt,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY c.property_price_total / c.num_units::numeric)
            FILTER (WHERE c.sale_transaction_date::date >= b.midpoint)             AS current_median,
        COUNT(*) FILTER (WHERE c.sale_transaction_date::date >= b.midpoint)        AS current_cnt,
        COUNT(*)                                                                    AS total_n
    FROM crexi_api_comps c
    JOIN county_boundaries cb ON ST_Within(c.geom, cb.geom)
    CROSS JOIN bounds b
    WHERE c.is_sales_comp = true
      AND NOT c.exclude_from_sales_trends
      AND c.property_price_total IS NOT NULL AND c.property_price_total > 0
      AND c.num_units IS NOT NULL AND c.num_units > 0
      AND c.sale_transaction_date IS NOT NULL
      AND c.geom IS NOT NULL
      AND c.sale_transaction_date::date >= b.window_start
    GROUP BY cb.name_lsad, cb.state
)
SELECT
    c.county_name,
    c.state,
    ST_AsGeoJSON(ST_SimplifyPreserveTopology(cb.geom, 0.001))                     AS geom_json,
    c.current_median,
    c.prior_median,
    CASE WHEN c.prior_cnt >= 2 AND c.current_cnt >= 2 AND c.prior_median > 0
        THEN ROUND(((c.current_median - c.prior_median) / c.prior_median * 100)::numeric, 1)
        ELSE NULL
    END                                                                            AS pct_change,
    c.total_n                                                                      AS listing_count
FROM combined c
JOIN county_boundaries cb ON cb.name_lsad = c.county_name AND cb.state = c.state
WHERE cb.geom IS NOT NULL
  AND c.prior_cnt >= 2
  AND c.current_cnt >= 2;
$function$;

CREATE OR REPLACE FUNCTION public.get_map_crexi_sales_trends_by_msa(
    p_months_back integer DEFAULT 12
)
RETURNS TABLE(
    geoid          text,
    name           text,
    geom_json      text,
    current_median numeric,
    prior_median   numeric,
    pct_change     numeric,
    listing_count  bigint
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET statement_timeout = '30s'
AS $function$
WITH bounds AS (
    SELECT
        (NOW()::date - (p_months_back || ' months')::interval)::date AS window_start,
        (NOW()::date - (p_months_back / 2 || ' months')::interval)::date AS midpoint
),
combined AS (
    SELECT
        mb.geoid,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY c.property_price_total / c.num_units::numeric)
            FILTER (WHERE c.sale_transaction_date::date <  b.midpoint)             AS prior_median,
        COUNT(*) FILTER (WHERE c.sale_transaction_date::date <  b.midpoint)        AS prior_cnt,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY c.property_price_total / c.num_units::numeric)
            FILTER (WHERE c.sale_transaction_date::date >= b.midpoint)             AS current_median,
        COUNT(*) FILTER (WHERE c.sale_transaction_date::date >= b.midpoint)        AS current_cnt,
        COUNT(*)                                                                    AS total_n
    FROM crexi_api_comps c
    JOIN msa_boundaries mb ON ST_Within(c.geom, mb.geom)
    CROSS JOIN bounds b
    WHERE c.is_sales_comp = true
      AND NOT c.exclude_from_sales_trends
      AND c.property_price_total IS NOT NULL AND c.property_price_total > 0
      AND c.num_units IS NOT NULL AND c.num_units > 0
      AND c.sale_transaction_date IS NOT NULL
      AND c.geom IS NOT NULL
      AND c.sale_transaction_date::date >= b.window_start
    GROUP BY mb.geoid
)
SELECT
    mb.geoid,
    mb.name::text,
    ST_AsGeoJSON(ST_SimplifyPreserveTopology(mb.geom, 0.005))                     AS geom_json,
    c.current_median,
    c.prior_median,
    CASE WHEN c.prior_cnt >= 2 AND c.current_cnt >= 2 AND c.prior_median > 0
        THEN ROUND(((c.current_median - c.prior_median) / c.prior_median * 100)::numeric, 1)
        ELSE NULL
    END                                                                            AS pct_change,
    c.total_n                                                                      AS listing_count
FROM combined c
JOIN msa_boundaries mb ON c.geoid = mb.geoid
WHERE mb.geom IS NOT NULL
  AND c.prior_cnt >= 2
  AND c.current_cnt >= 2;
$function$;

