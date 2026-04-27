-- Fix pct_change calculation in all map sales trends RPCs (half-window approach).
--
-- The previous migration (070000) also rewrote these functions but was applied
-- with a two-pass design (prior_half CTE + current_half CTE) that doubled the
-- spatial JOIN cost and caused statement timeouts on the neighborhood/county/MSA
-- variants. This migration rewrites them with a single-pass FILTER approach:
-- one scan + spatial join, two PERCENTILE_CONT FILTER windows.
--
-- Logic: split the p_months_back window at the midpoint and compare
--   prior_median  = PERCENTILE_CONT over the first half of the window
--   current_median = PERCENTILE_CONT over the second half of the window
-- Regions where either half has < 2 transactions show pct_change = NULL (grey).

-- ══════════════════════════════════════════════════════════════════════════════
-- LoopNet variants
-- ══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_map_sales_trends(
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
        (NOW() - (p_months_back || ' months')::interval)::date AS window_start,
        (NOW() - (p_months_back / 2 || ' months')::interval)::date AS midpoint
),
combined AS (
    SELECT
        d.address_zip                                                              AS z,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY s.price_numeric)
            FILTER (WHERE s.scraped_at::date <  b.midpoint)                        AS prior_median,
        COUNT(*) FILTER (WHERE s.scraped_at::date <  b.midpoint)                   AS prior_cnt,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY s.price_numeric)
            FILTER (WHERE s.scraped_at::date >= b.midpoint)                        AS current_median,
        COUNT(*) FILTER (WHERE s.scraped_at::date >= b.midpoint)                   AS current_cnt,
        COUNT(*)                                                                    AS total_n
    FROM loopnet_listing_snapshots s
    JOIN loopnet_listing_details d ON d.listing_url = s.listing_url
    CROSS JOIN bounds b
    WHERE s.price_numeric IS NOT NULL AND s.price_numeric > 0
      AND d.address_zip IS NOT NULL
      AND s.scraped_at::date >= b.window_start
    GROUP BY d.address_zip
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

CREATE OR REPLACE FUNCTION public.get_map_sales_trends_by_neighborhood(
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
        (NOW() - (p_months_back || ' months')::interval)::date AS window_start,
        (NOW() - (p_months_back / 2 || ' months')::interval)::date AS midpoint
),
combined AS (
    SELECT
        n.id                                                                       AS nh_id,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY s.price_numeric)
            FILTER (WHERE s.scraped_at::date <  b.midpoint)                        AS prior_median,
        COUNT(*) FILTER (WHERE s.scraped_at::date <  b.midpoint)                   AS prior_cnt,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY s.price_numeric)
            FILTER (WHERE s.scraped_at::date >= b.midpoint)                        AS current_median,
        COUNT(*) FILTER (WHERE s.scraped_at::date >= b.midpoint)                   AS current_cnt,
        COUNT(*)                                                                    AS total_n
    FROM loopnet_listing_snapshots s
    JOIN loopnet_listing_details d ON d.listing_url = s.listing_url
    JOIN neighborhoods n ON ST_Within(d.geom, n.geom)
    CROSS JOIN bounds b
    WHERE s.price_numeric IS NOT NULL AND s.price_numeric > 0
      AND d.geom IS NOT NULL
      AND s.scraped_at::date >= b.window_start
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

CREATE OR REPLACE FUNCTION public.get_map_sales_trends_by_city(
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
        (NOW() - (p_months_back || ' months')::interval)::date AS window_start,
        (NOW() - (p_months_back / 2 || ' months')::interval)::date AS midpoint
),
combined AS (
    SELECT
        cb.name                                                                    AS city_name,
        cb.state,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY s.price_numeric)
            FILTER (WHERE s.scraped_at::date <  b.midpoint)                        AS prior_median,
        COUNT(*) FILTER (WHERE s.scraped_at::date <  b.midpoint)                   AS prior_cnt,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY s.price_numeric)
            FILTER (WHERE s.scraped_at::date >= b.midpoint)                        AS current_median,
        COUNT(*) FILTER (WHERE s.scraped_at::date >= b.midpoint)                   AS current_cnt,
        COUNT(*)                                                                    AS total_n
    FROM loopnet_listing_snapshots s
    JOIN loopnet_listing_details d ON d.listing_url = s.listing_url
    JOIN city_boundaries cb
        ON lower(d.address_city)  = lower(cb.name)
        AND lower(d.address_state) = lower(cb.state)
    CROSS JOIN bounds b
    WHERE s.price_numeric IS NOT NULL AND s.price_numeric > 0
      AND d.address_city IS NOT NULL
      AND s.scraped_at::date >= b.window_start
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

CREATE OR REPLACE FUNCTION public.get_map_sales_trends_by_county(
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
        (NOW() - (p_months_back || ' months')::interval)::date AS window_start,
        (NOW() - (p_months_back / 2 || ' months')::interval)::date AS midpoint
),
combined AS (
    SELECT
        cb.name_lsad                                                               AS county_name,
        cb.state,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY s.price_numeric)
            FILTER (WHERE s.scraped_at::date <  b.midpoint)                        AS prior_median,
        COUNT(*) FILTER (WHERE s.scraped_at::date <  b.midpoint)                   AS prior_cnt,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY s.price_numeric)
            FILTER (WHERE s.scraped_at::date >= b.midpoint)                        AS current_median,
        COUNT(*) FILTER (WHERE s.scraped_at::date >= b.midpoint)                   AS current_cnt,
        COUNT(*)                                                                    AS total_n
    FROM loopnet_listing_snapshots s
    JOIN loopnet_listing_details d ON d.listing_url = s.listing_url
    JOIN county_boundaries cb ON ST_Within(d.geom, cb.geom)
    CROSS JOIN bounds b
    WHERE s.price_numeric IS NOT NULL AND s.price_numeric > 0
      AND d.geom IS NOT NULL
      AND s.scraped_at::date >= b.window_start
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

CREATE OR REPLACE FUNCTION public.get_map_sales_trends_by_msa(
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
        (NOW() - (p_months_back || ' months')::interval)::date AS window_start,
        (NOW() - (p_months_back / 2 || ' months')::interval)::date AS midpoint
),
combined AS (
    SELECT
        mb.geoid,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY s.price_numeric)
            FILTER (WHERE s.scraped_at::date <  b.midpoint)                        AS prior_median,
        COUNT(*) FILTER (WHERE s.scraped_at::date <  b.midpoint)                   AS prior_cnt,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY s.price_numeric)
            FILTER (WHERE s.scraped_at::date >= b.midpoint)                        AS current_median,
        COUNT(*) FILTER (WHERE s.scraped_at::date >= b.midpoint)                   AS current_cnt,
        COUNT(*)                                                                    AS total_n
    FROM loopnet_listing_snapshots s
    JOIN loopnet_listing_details d ON d.listing_url = s.listing_url
    JOIN msa_boundaries mb ON ST_Within(d.geom, mb.geom)
    CROSS JOIN bounds b
    WHERE s.price_numeric IS NOT NULL AND s.price_numeric > 0
      AND d.geom IS NOT NULL
      AND s.scraped_at::date >= b.window_start
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

-- ══════════════════════════════════════════════════════════════════════════════
-- Crexi variants
-- ══════════════════════════════════════════════════════════════════════════════

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
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY c.property_price_total)
            FILTER (WHERE c.sale_transaction_date::date <  b.midpoint)             AS prior_median,
        COUNT(*) FILTER (WHERE c.sale_transaction_date::date <  b.midpoint)        AS prior_cnt,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY c.property_price_total)
            FILTER (WHERE c.sale_transaction_date::date >= b.midpoint)             AS current_median,
        COUNT(*) FILTER (WHERE c.sale_transaction_date::date >= b.midpoint)        AS current_cnt,
        COUNT(*)                                                                    AS total_n
    FROM crexi_api_comps c
    CROSS JOIN bounds b
    WHERE c.is_sales_comp = true
      AND c.property_price_total IS NOT NULL AND c.property_price_total > 0
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
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY c.property_price_total)
            FILTER (WHERE c.sale_transaction_date::date <  b.midpoint)             AS prior_median,
        COUNT(*) FILTER (WHERE c.sale_transaction_date::date <  b.midpoint)        AS prior_cnt,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY c.property_price_total)
            FILTER (WHERE c.sale_transaction_date::date >= b.midpoint)             AS current_median,
        COUNT(*) FILTER (WHERE c.sale_transaction_date::date >= b.midpoint)        AS current_cnt,
        COUNT(*)                                                                    AS total_n
    FROM crexi_api_comps c
    JOIN neighborhoods n ON ST_Within(c.geom, n.geom)
    CROSS JOIN bounds b
    WHERE c.is_sales_comp = true
      AND c.property_price_total IS NOT NULL AND c.property_price_total > 0
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
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY c.property_price_total)
            FILTER (WHERE c.sale_transaction_date::date <  b.midpoint)             AS prior_median,
        COUNT(*) FILTER (WHERE c.sale_transaction_date::date <  b.midpoint)        AS prior_cnt,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY c.property_price_total)
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
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY c.property_price_total)
            FILTER (WHERE c.sale_transaction_date::date <  b.midpoint)             AS prior_median,
        COUNT(*) FILTER (WHERE c.sale_transaction_date::date <  b.midpoint)        AS prior_cnt,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY c.property_price_total)
            FILTER (WHERE c.sale_transaction_date::date >= b.midpoint)             AS current_median,
        COUNT(*) FILTER (WHERE c.sale_transaction_date::date >= b.midpoint)        AS current_cnt,
        COUNT(*)                                                                    AS total_n
    FROM crexi_api_comps c
    JOIN county_boundaries cb ON ST_Within(c.geom, cb.geom)
    CROSS JOIN bounds b
    WHERE c.is_sales_comp = true
      AND c.property_price_total IS NOT NULL AND c.property_price_total > 0
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
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY c.property_price_total)
            FILTER (WHERE c.sale_transaction_date::date <  b.midpoint)             AS prior_median,
        COUNT(*) FILTER (WHERE c.sale_transaction_date::date <  b.midpoint)        AS prior_cnt,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY c.property_price_total)
            FILTER (WHERE c.sale_transaction_date::date >= b.midpoint)             AS current_median,
        COUNT(*) FILTER (WHERE c.sale_transaction_date::date >= b.midpoint)        AS current_cnt,
        COUNT(*)                                                                    AS total_n
    FROM crexi_api_comps c
    JOIN msa_boundaries mb ON ST_Within(c.geom, mb.geom)
    CROSS JOIN bounds b
    WHERE c.is_sales_comp = true
      AND c.property_price_total IS NOT NULL AND c.property_price_total > 0
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
