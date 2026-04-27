-- Map sales trends RPCs — choropleth data for the sales trends map view.
--
-- These parallel the get_map_rent_trends* family but source from:
--   • LoopNet: loopnet_listing_snapshots + loopnet_listing_details (price_numeric / geom)
--   • Crexi:   crexi_api_comps (property_price_total / geom, is_sales_comp = true)
--
-- Each function returns one row per geographic region with:
--   current_median  — median sale price for the most recent month in the window
--   prior_median    — median sale price for the earliest month in the window
--   pct_change      — (current - prior) / prior * 100, rounded to 1 dp
--   listing_count   — total transactions in the window
--   geom_json       — simplified GeoJSON polygon for Mapbox fill layer
--
-- The time window is controlled by p_months_back (default 12 months).
-- Month granularity is used instead of weeks because commercial sale data
-- is sparse relative to rental listings.

-- ══════════════════════════════════════════════════════════════════════════════
-- LoopNet variants
-- ══════════════════════════════════════════════════════════════════════════════

-- ── 1. ZIP ───────────────────────────────────────────────────────────────────

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
WITH monthly AS (
    SELECT
        d.address_zip                                                              AS z,
        DATE_TRUNC('month', s.scraped_at)::date                                   AS month_start,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY s.price_numeric)              AS median_price,
        COUNT(*)                                                                   AS n
    FROM loopnet_listing_snapshots s
    JOIN loopnet_listing_details d ON d.listing_url = s.listing_url
    WHERE s.price_numeric IS NOT NULL AND s.price_numeric > 0
      AND d.address_zip IS NOT NULL
      AND s.scraped_at >= NOW() - (p_months_back || ' months')::interval
    GROUP BY d.address_zip, month_start
),
ranked AS (
    SELECT
        z,
        median_price,
        n,
        ROW_NUMBER() OVER (PARTITION BY z ORDER BY month_start DESC) AS rn_desc,
        ROW_NUMBER() OVER (PARTITION BY z ORDER BY month_start ASC)  AS rn_asc,
        COUNT(*)     OVER (PARTITION BY z)                           AS month_count,
        SUM(n)       OVER (PARTITION BY z)                           AS total_n
    FROM monthly
),
current_vals AS (SELECT z, median_price, total_n FROM ranked WHERE rn_desc = 1 AND month_count >= 2),
prior_vals   AS (SELECT z, median_price           FROM ranked WHERE rn_asc  = 1 AND month_count >= 2)
SELECT
    c.z                                                                            AS zip,
    ST_AsGeoJSON(ST_SimplifyPreserveTopology(zk.geom, 0.001))                     AS geom_json,
    c.median_price                                                                 AS current_median,
    p.median_price                                                                 AS prior_median,
    CASE WHEN p.median_price > 0
        THEN ROUND(((c.median_price - p.median_price) / p.median_price * 100)::numeric, 1)
        ELSE NULL
    END                                                                            AS pct_change,
    c.total_n                                                                      AS listing_count
FROM current_vals c
JOIN prior_vals   p  ON c.z  = p.z
JOIN zip_codes   zk  ON c.z  = zk.zip
WHERE zk.geom IS NOT NULL;
$function$;

-- ── 2. Neighborhood ──────────────────────────────────────────────────────────

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
WITH monthly AS (
    SELECT
        n.id                                                                       AS nh_id,
        DATE_TRUNC('month', s.scraped_at)::date                                   AS month_start,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY s.price_numeric)              AS median_price,
        COUNT(*)                                                                   AS cnt
    FROM loopnet_listing_snapshots s
    JOIN loopnet_listing_details d ON d.listing_url = s.listing_url
    JOIN neighborhoods n ON ST_Within(d.geom, n.geom)
    WHERE s.price_numeric IS NOT NULL AND s.price_numeric > 0
      AND d.geom IS NOT NULL
      AND s.scraped_at >= NOW() - (p_months_back || ' months')::interval
    GROUP BY n.id, month_start
),
ranked AS (
    SELECT
        nh_id,
        median_price,
        cnt,
        ROW_NUMBER() OVER (PARTITION BY nh_id ORDER BY month_start DESC) AS rn_desc,
        ROW_NUMBER() OVER (PARTITION BY nh_id ORDER BY month_start ASC)  AS rn_asc,
        COUNT(*)     OVER (PARTITION BY nh_id)                           AS month_count,
        SUM(cnt)     OVER (PARTITION BY nh_id)                           AS total_n
    FROM monthly
),
current_vals AS (SELECT nh_id, median_price, total_n FROM ranked WHERE rn_desc = 1 AND month_count >= 2),
prior_vals   AS (SELECT nh_id, median_price           FROM ranked WHERE rn_asc  = 1 AND month_count >= 2)
SELECT
    n.id                                                                           AS neighborhood_id,
    n.name::text,
    n.city::text,
    ST_AsGeoJSON(ST_SimplifyPreserveTopology(n.geom, 0.0005))                     AS geom_json,
    c.median_price                                                                 AS current_median,
    p.median_price                                                                 AS prior_median,
    CASE WHEN p.median_price > 0
        THEN ROUND(((c.median_price - p.median_price) / p.median_price * 100)::numeric, 1)
        ELSE NULL
    END                                                                            AS pct_change,
    c.total_n                                                                      AS listing_count
FROM current_vals c
JOIN prior_vals   p  ON c.nh_id = p.nh_id
JOIN neighborhoods n ON c.nh_id = n.id
WHERE n.geom IS NOT NULL;
$function$;

-- ── 3. City ──────────────────────────────────────────────────────────────────

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
WITH monthly AS (
    SELECT
        cb.name                                                                    AS city_name,
        cb.state,
        DATE_TRUNC('month', s.scraped_at)::date                                   AS month_start,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY s.price_numeric)              AS median_price,
        COUNT(*)                                                                   AS cnt
    FROM loopnet_listing_snapshots s
    JOIN loopnet_listing_details d ON d.listing_url = s.listing_url
    JOIN city_boundaries cb
        ON lower(d.address_city)  = lower(cb.name)
        AND lower(d.address_state) = lower(cb.state)
    WHERE s.price_numeric IS NOT NULL AND s.price_numeric > 0
      AND d.address_city IS NOT NULL
      AND s.scraped_at >= NOW() - (p_months_back || ' months')::interval
    GROUP BY cb.name, cb.state, month_start
),
ranked AS (
    SELECT
        city_name,
        state,
        median_price,
        cnt,
        ROW_NUMBER() OVER (PARTITION BY city_name, state ORDER BY month_start DESC) AS rn_desc,
        ROW_NUMBER() OVER (PARTITION BY city_name, state ORDER BY month_start ASC)  AS rn_asc,
        COUNT(*)     OVER (PARTITION BY city_name, state)                           AS month_count,
        SUM(cnt)     OVER (PARTITION BY city_name, state)                           AS total_n
    FROM monthly
),
current_vals AS (SELECT city_name, state, median_price, total_n FROM ranked WHERE rn_desc = 1 AND month_count >= 2),
prior_vals   AS (SELECT city_name, state, median_price           FROM ranked WHERE rn_asc  = 1 AND month_count >= 2)
SELECT
    c.city_name,
    c.state,
    ST_AsGeoJSON(ST_SimplifyPreserveTopology(cb.geom, 0.0001))                    AS geom_json,
    c.median_price                                                                 AS current_median,
    p.median_price                                                                 AS prior_median,
    CASE WHEN p.median_price > 0
        THEN ROUND(((c.median_price - p.median_price) / p.median_price * 100)::numeric, 1)
        ELSE NULL
    END                                                                            AS pct_change,
    c.total_n                                                                      AS listing_count
FROM current_vals c
JOIN prior_vals   p  ON c.city_name = p.city_name AND c.state = p.state
JOIN city_boundaries cb ON cb.name = c.city_name AND cb.state = c.state
WHERE cb.geom IS NOT NULL;
$function$;

-- ── 4. County ────────────────────────────────────────────────────────────────

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
WITH monthly AS (
    SELECT
        cb.name_lsad                                                               AS county_name,
        cb.state,
        DATE_TRUNC('month', s.scraped_at)::date                                   AS month_start,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY s.price_numeric)              AS median_price,
        COUNT(*)                                                                   AS cnt
    FROM loopnet_listing_snapshots s
    JOIN loopnet_listing_details d ON d.listing_url = s.listing_url
    JOIN county_boundaries cb ON ST_Within(d.geom, cb.geom)
    WHERE s.price_numeric IS NOT NULL AND s.price_numeric > 0
      AND d.geom IS NOT NULL
      AND s.scraped_at >= NOW() - (p_months_back || ' months')::interval
    GROUP BY cb.name_lsad, cb.state, month_start
),
ranked AS (
    SELECT
        county_name,
        state,
        median_price,
        cnt,
        ROW_NUMBER() OVER (PARTITION BY county_name, state ORDER BY month_start DESC) AS rn_desc,
        ROW_NUMBER() OVER (PARTITION BY county_name, state ORDER BY month_start ASC)  AS rn_asc,
        COUNT(*)     OVER (PARTITION BY county_name, state)                           AS month_count,
        SUM(cnt)     OVER (PARTITION BY county_name, state)                           AS total_n
    FROM monthly
),
current_vals AS (SELECT county_name, state, median_price, total_n FROM ranked WHERE rn_desc = 1 AND month_count >= 2),
prior_vals   AS (SELECT county_name, state, median_price           FROM ranked WHERE rn_asc  = 1 AND month_count >= 2)
SELECT
    c.county_name,
    c.state,
    ST_AsGeoJSON(ST_SimplifyPreserveTopology(cb.geom, 0.001))                     AS geom_json,
    c.median_price                                                                 AS current_median,
    p.median_price                                                                 AS prior_median,
    CASE WHEN p.median_price > 0
        THEN ROUND(((c.median_price - p.median_price) / p.median_price * 100)::numeric, 1)
        ELSE NULL
    END                                                                            AS pct_change,
    c.total_n                                                                      AS listing_count
FROM current_vals c
JOIN prior_vals   p  ON c.county_name = p.county_name AND c.state = p.state
JOIN county_boundaries cb ON cb.name_lsad = c.county_name AND cb.state = c.state
WHERE cb.geom IS NOT NULL;
$function$;

-- ── 5. MSA ───────────────────────────────────────────────────────────────────

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
WITH monthly AS (
    SELECT
        mb.geoid,
        DATE_TRUNC('month', s.scraped_at)::date                                   AS month_start,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY s.price_numeric)              AS median_price,
        COUNT(*)                                                                   AS cnt
    FROM loopnet_listing_snapshots s
    JOIN loopnet_listing_details d ON d.listing_url = s.listing_url
    JOIN msa_boundaries mb ON ST_Within(d.geom, mb.geom)
    WHERE s.price_numeric IS NOT NULL AND s.price_numeric > 0
      AND d.geom IS NOT NULL
      AND s.scraped_at >= NOW() - (p_months_back || ' months')::interval
    GROUP BY mb.geoid, month_start
),
ranked AS (
    SELECT
        geoid,
        median_price,
        cnt,
        ROW_NUMBER() OVER (PARTITION BY geoid ORDER BY month_start DESC) AS rn_desc,
        ROW_NUMBER() OVER (PARTITION BY geoid ORDER BY month_start ASC)  AS rn_asc,
        COUNT(*)     OVER (PARTITION BY geoid)                           AS month_count,
        SUM(cnt)     OVER (PARTITION BY geoid)                           AS total_n
    FROM monthly
),
current_vals AS (SELECT geoid, median_price, total_n FROM ranked WHERE rn_desc = 1 AND month_count >= 2),
prior_vals   AS (SELECT geoid, median_price           FROM ranked WHERE rn_asc  = 1 AND month_count >= 2)
SELECT
    mb.geoid,
    mb.name::text,
    ST_AsGeoJSON(ST_SimplifyPreserveTopology(mb.geom, 0.005))                     AS geom_json,
    c.median_price                                                                 AS current_median,
    p.median_price                                                                 AS prior_median,
    CASE WHEN p.median_price > 0
        THEN ROUND(((c.median_price - p.median_price) / p.median_price * 100)::numeric, 1)
        ELSE NULL
    END                                                                            AS pct_change,
    c.total_n                                                                      AS listing_count
FROM current_vals c
JOIN prior_vals   p  ON c.geoid = p.geoid
JOIN msa_boundaries mb ON c.geoid = mb.geoid
WHERE mb.geom IS NOT NULL;
$function$;

-- ══════════════════════════════════════════════════════════════════════════════
-- Crexi variants (actual closed-sale comps)
-- ══════════════════════════════════════════════════════════════════════════════

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
WITH monthly AS (
    SELECT
        c.zip                                                                      AS z,
        DATE_TRUNC('month', c.sale_transaction_date::date)::date                  AS month_start,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY c.property_price_total)       AS median_price,
        COUNT(*)                                                                   AS n
    FROM crexi_api_comps c
    WHERE c.is_sales_comp = true
      AND c.property_price_total IS NOT NULL AND c.property_price_total > 0
      AND c.sale_transaction_date IS NOT NULL
      AND c.zip IS NOT NULL
      AND c.sale_transaction_date::date >= NOW()::date - (p_months_back || ' months')::interval
    GROUP BY c.zip, month_start
),
ranked AS (
    SELECT
        z,
        median_price,
        n,
        ROW_NUMBER() OVER (PARTITION BY z ORDER BY month_start DESC) AS rn_desc,
        ROW_NUMBER() OVER (PARTITION BY z ORDER BY month_start ASC)  AS rn_asc,
        COUNT(*)     OVER (PARTITION BY z)                           AS month_count,
        SUM(n)       OVER (PARTITION BY z)                           AS total_n
    FROM monthly
),
current_vals AS (SELECT z, median_price, total_n FROM ranked WHERE rn_desc = 1 AND month_count >= 2),
prior_vals   AS (SELECT z, median_price           FROM ranked WHERE rn_asc  = 1 AND month_count >= 2)
SELECT
    c.z                                                                            AS zip,
    ST_AsGeoJSON(ST_SimplifyPreserveTopology(zk.geom, 0.001))                     AS geom_json,
    c.median_price                                                                 AS current_median,
    p.median_price                                                                 AS prior_median,
    CASE WHEN p.median_price > 0
        THEN ROUND(((c.median_price - p.median_price) / p.median_price * 100)::numeric, 1)
        ELSE NULL
    END                                                                            AS pct_change,
    c.total_n                                                                      AS listing_count
FROM current_vals c
JOIN prior_vals   p  ON c.z  = p.z
JOIN zip_codes   zk  ON c.z  = zk.zip
WHERE zk.geom IS NOT NULL;
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
WITH monthly AS (
    SELECT
        n.id                                                                       AS nh_id,
        DATE_TRUNC('month', c.sale_transaction_date::date)::date                  AS month_start,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY c.property_price_total)       AS median_price,
        COUNT(*)                                                                   AS cnt
    FROM crexi_api_comps c
    JOIN neighborhoods n ON ST_Within(c.geom, n.geom)
    WHERE c.is_sales_comp = true
      AND c.property_price_total IS NOT NULL AND c.property_price_total > 0
      AND c.sale_transaction_date IS NOT NULL
      AND c.geom IS NOT NULL
      AND c.sale_transaction_date::date >= NOW()::date - (p_months_back || ' months')::interval
    GROUP BY n.id, month_start
),
ranked AS (
    SELECT
        nh_id,
        median_price,
        cnt,
        ROW_NUMBER() OVER (PARTITION BY nh_id ORDER BY month_start DESC) AS rn_desc,
        ROW_NUMBER() OVER (PARTITION BY nh_id ORDER BY month_start ASC)  AS rn_asc,
        COUNT(*)     OVER (PARTITION BY nh_id)                           AS month_count,
        SUM(cnt)     OVER (PARTITION BY nh_id)                           AS total_n
    FROM monthly
),
current_vals AS (SELECT nh_id, median_price, total_n FROM ranked WHERE rn_desc = 1 AND month_count >= 2),
prior_vals   AS (SELECT nh_id, median_price           FROM ranked WHERE rn_asc  = 1 AND month_count >= 2)
SELECT
    n.id                                                                           AS neighborhood_id,
    n.name::text,
    n.city::text,
    ST_AsGeoJSON(ST_SimplifyPreserveTopology(n.geom, 0.0005))                     AS geom_json,
    c.median_price                                                                 AS current_median,
    p.median_price                                                                 AS prior_median,
    CASE WHEN p.median_price > 0
        THEN ROUND(((c.median_price - p.median_price) / p.median_price * 100)::numeric, 1)
        ELSE NULL
    END                                                                            AS pct_change,
    c.total_n                                                                      AS listing_count
FROM current_vals c
JOIN prior_vals   p  ON c.nh_id = p.nh_id
JOIN neighborhoods n ON c.nh_id = n.id
WHERE n.geom IS NOT NULL;
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
WITH monthly AS (
    SELECT
        cb.name                                                                    AS city_name,
        cb.state,
        DATE_TRUNC('month', c.sale_transaction_date::date)::date                  AS month_start,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY c.property_price_total)       AS median_price,
        COUNT(*)                                                                   AS cnt
    FROM crexi_api_comps c
    JOIN city_boundaries cb
        ON lower(c.city)  = lower(cb.name)
        AND lower(c.state) = lower(cb.state)
    WHERE c.is_sales_comp = true
      AND c.property_price_total IS NOT NULL AND c.property_price_total > 0
      AND c.sale_transaction_date IS NOT NULL
      AND c.city IS NOT NULL
      AND c.sale_transaction_date::date >= NOW()::date - (p_months_back || ' months')::interval
    GROUP BY cb.name, cb.state, month_start
),
ranked AS (
    SELECT
        city_name,
        state,
        median_price,
        cnt,
        ROW_NUMBER() OVER (PARTITION BY city_name, state ORDER BY month_start DESC) AS rn_desc,
        ROW_NUMBER() OVER (PARTITION BY city_name, state ORDER BY month_start ASC)  AS rn_asc,
        COUNT(*)     OVER (PARTITION BY city_name, state)                           AS month_count,
        SUM(cnt)     OVER (PARTITION BY city_name, state)                           AS total_n
    FROM monthly
),
current_vals AS (SELECT city_name, state, median_price, total_n FROM ranked WHERE rn_desc = 1 AND month_count >= 2),
prior_vals   AS (SELECT city_name, state, median_price           FROM ranked WHERE rn_asc  = 1 AND month_count >= 2)
SELECT
    c.city_name,
    c.state,
    ST_AsGeoJSON(ST_SimplifyPreserveTopology(cb.geom, 0.0001))                    AS geom_json,
    c.median_price                                                                 AS current_median,
    p.median_price                                                                 AS prior_median,
    CASE WHEN p.median_price > 0
        THEN ROUND(((c.median_price - p.median_price) / p.median_price * 100)::numeric, 1)
        ELSE NULL
    END                                                                            AS pct_change,
    c.total_n                                                                      AS listing_count
FROM current_vals c
JOIN prior_vals   p  ON c.city_name = p.city_name AND c.state = p.state
JOIN city_boundaries cb ON cb.name = c.city_name AND cb.state = c.state
WHERE cb.geom IS NOT NULL;
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
WITH monthly AS (
    SELECT
        cb.name_lsad                                                               AS county_name,
        cb.state,
        DATE_TRUNC('month', c.sale_transaction_date::date)::date                  AS month_start,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY c.property_price_total)       AS median_price,
        COUNT(*)                                                                   AS cnt
    FROM crexi_api_comps c
    JOIN county_boundaries cb ON ST_Within(c.geom, cb.geom)
    WHERE c.is_sales_comp = true
      AND c.property_price_total IS NOT NULL AND c.property_price_total > 0
      AND c.sale_transaction_date IS NOT NULL
      AND c.geom IS NOT NULL
      AND c.sale_transaction_date::date >= NOW()::date - (p_months_back || ' months')::interval
    GROUP BY cb.name_lsad, cb.state, month_start
),
ranked AS (
    SELECT
        county_name,
        state,
        median_price,
        cnt,
        ROW_NUMBER() OVER (PARTITION BY county_name, state ORDER BY month_start DESC) AS rn_desc,
        ROW_NUMBER() OVER (PARTITION BY county_name, state ORDER BY month_start ASC)  AS rn_asc,
        COUNT(*)     OVER (PARTITION BY county_name, state)                           AS month_count,
        SUM(cnt)     OVER (PARTITION BY county_name, state)                           AS total_n
    FROM monthly
),
current_vals AS (SELECT county_name, state, median_price, total_n FROM ranked WHERE rn_desc = 1 AND month_count >= 2),
prior_vals   AS (SELECT county_name, state, median_price           FROM ranked WHERE rn_asc  = 1 AND month_count >= 2)
SELECT
    c.county_name,
    c.state,
    ST_AsGeoJSON(ST_SimplifyPreserveTopology(cb.geom, 0.001))                     AS geom_json,
    c.median_price                                                                 AS current_median,
    p.median_price                                                                 AS prior_median,
    CASE WHEN p.median_price > 0
        THEN ROUND(((c.median_price - p.median_price) / p.median_price * 100)::numeric, 1)
        ELSE NULL
    END                                                                            AS pct_change,
    c.total_n                                                                      AS listing_count
FROM current_vals c
JOIN prior_vals   p  ON c.county_name = p.county_name AND c.state = p.state
JOIN county_boundaries cb ON cb.name_lsad = c.county_name AND cb.state = c.state
WHERE cb.geom IS NOT NULL;
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
WITH monthly AS (
    SELECT
        mb.geoid,
        DATE_TRUNC('month', c.sale_transaction_date::date)::date                  AS month_start,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY c.property_price_total)       AS median_price,
        COUNT(*)                                                                   AS cnt
    FROM crexi_api_comps c
    JOIN msa_boundaries mb ON ST_Within(c.geom, mb.geom)
    WHERE c.is_sales_comp = true
      AND c.property_price_total IS NOT NULL AND c.property_price_total > 0
      AND c.sale_transaction_date IS NOT NULL
      AND c.geom IS NOT NULL
      AND c.sale_transaction_date::date >= NOW()::date - (p_months_back || ' months')::interval
    GROUP BY mb.geoid, month_start
),
ranked AS (
    SELECT
        geoid,
        median_price,
        cnt,
        ROW_NUMBER() OVER (PARTITION BY geoid ORDER BY month_start DESC) AS rn_desc,
        ROW_NUMBER() OVER (PARTITION BY geoid ORDER BY month_start ASC)  AS rn_asc,
        COUNT(*)     OVER (PARTITION BY geoid)                           AS month_count,
        SUM(cnt)     OVER (PARTITION BY geoid)                           AS total_n
    FROM monthly
),
current_vals AS (SELECT geoid, median_price, total_n FROM ranked WHERE rn_desc = 1 AND month_count >= 2),
prior_vals   AS (SELECT geoid, median_price           FROM ranked WHERE rn_asc  = 1 AND month_count >= 2)
SELECT
    mb.geoid,
    mb.name::text,
    ST_AsGeoJSON(ST_SimplifyPreserveTopology(mb.geom, 0.005))                     AS geom_json,
    c.median_price                                                                 AS current_median,
    p.median_price                                                                 AS prior_median,
    CASE WHEN p.median_price > 0
        THEN ROUND(((c.median_price - p.median_price) / p.median_price * 100)::numeric, 1)
        ELSE NULL
    END                                                                            AS pct_change,
    c.total_n                                                                      AS listing_count
FROM current_vals c
JOIN prior_vals   p  ON c.geoid = p.geoid
JOIN msa_boundaries mb ON c.geoid = mb.geoid
WHERE mb.geom IS NOT NULL;
$function$;
