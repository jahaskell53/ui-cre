-- Fix get_map_crexi_sales_trends* to use price-per-door with the half-window
-- approach (first-half vs second-half median) that was established in
-- 20260427080000. The previous migration (20260428000000) accidentally reverted
-- the Crexi map RPCs to the old first-month vs last-month style.
--
-- Changes vs 20260427080000:
--   • ORDER BY / FILTER expression: property_price_total / num_units::numeric
--   • Added: num_units IS NOT NULL AND num_units > 0 to WHERE clause

-- ── 1. ZIP ───────────────────────────────────────────────────────────────────

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
        c.zip                                                                      AS z,
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
      AND c.property_price_total IS NOT NULL AND c.property_price_total > 0
      AND c.num_units IS NOT NULL AND c.num_units > 0
      AND c.sale_transaction_date IS NOT NULL
      AND c.zip IS NOT NULL
      AND c.sale_transaction_date::date >= b.window_start
    GROUP BY c.zip
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

-- ── 2. Neighborhood ──────────────────────────────────────────────────────────

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

-- ── 3. City ──────────────────────────────────────────────────────────────────

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

-- ── 4. County ────────────────────────────────────────────────────────────────

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

-- ── 5. MSA ───────────────────────────────────────────────────────────────────

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
