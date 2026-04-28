-- Replace median total price with median price-per-door in all Crexi sales
-- trend RPCs (both the time-series variants and the map choropleth variants).
--
-- Only Crexi RPCs are changed; LoopNet variants are unchanged.  The output
-- column is still named `median_price` so no TypeScript changes are needed —
-- the value's semantics change from "median total sale price" to
-- "median (price ÷ num_units)".
--
-- Rows without a usable unit count (NULL or 0) are excluded from the
-- percentile calculation so they do not distort the per-door figure.

-- ══════════════════════════════════════════════════════════════════════════════
-- Time-series variants
-- ══════════════════════════════════════════════════════════════════════════════

-- ── 1. ZIP ──────────────────────────────────────────────────────────────────

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
    AND property_price_total IS NOT NULL AND property_price_total > 0
    AND num_units IS NOT NULL AND num_units > 0
    AND sale_transaction_date IS NOT NULL
    AND (p_zip IS NULL OR zip = p_zip)
  GROUP BY 1
  ORDER BY 1;
$function$;

-- ── 2. City ─────────────────────────────────────────────────────────────────

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
    AND property_price_total IS NOT NULL AND property_price_total > 0
    AND num_units IS NOT NULL AND num_units > 0
    AND sale_transaction_date IS NOT NULL
    AND city ILIKE p_city
    AND state ILIKE p_state
  GROUP BY 1
  ORDER BY 1;
$function$;

-- ── 3. County ───────────────────────────────────────────────────────────────

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
    AVG(COALESCE(sale_cap_rate_percent, financials_cap_rate_percent)) AS avg_cap_rate,
    COUNT(*) AS listing_count
  FROM crexi_api_comps c
  JOIN county_boundaries cb
    ON ST_Within(ST_SetSRID(ST_Point(c.longitude, c.latitude), 4326), cb.geom)
  WHERE
    c.is_sales_comp = true
    AND c.property_price_total IS NOT NULL AND c.property_price_total > 0
    AND c.num_units IS NOT NULL AND c.num_units > 0
    AND c.sale_transaction_date IS NOT NULL
    AND c.latitude IS NOT NULL AND c.longitude IS NOT NULL
    AND cb.name_lsad ILIKE p_county_name
    AND cb.state = p_state
  GROUP BY 1
  ORDER BY 1;
$function$;

-- ── 4. Neighborhood ─────────────────────────────────────────────────────────

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
    AVG(COALESCE(sale_cap_rate_percent, financials_cap_rate_percent)) AS avg_cap_rate,
    COUNT(*) AS listing_count
  FROM crexi_api_comps c
  JOIN neighborhoods n
    ON ST_Within(ST_SetSRID(ST_Point(c.longitude, c.latitude), 4326), n.geom)
  WHERE
    c.is_sales_comp = true
    AND c.property_price_total IS NOT NULL AND c.property_price_total > 0
    AND c.num_units IS NOT NULL AND c.num_units > 0
    AND c.sale_transaction_date IS NOT NULL
    AND c.latitude IS NOT NULL AND c.longitude IS NOT NULL
    AND n.id = ANY(p_neighborhood_ids)
  GROUP BY 1
  ORDER BY 1;
$function$;

-- ── 5. MSA ──────────────────────────────────────────────────────────────────

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
    AVG(COALESCE(sale_cap_rate_percent, financials_cap_rate_percent)) AS avg_cap_rate,
    COUNT(*) AS listing_count
  FROM crexi_api_comps c
  JOIN msa_boundaries mb
    ON ST_Within(ST_SetSRID(ST_Point(c.longitude, c.latitude), 4326), mb.geom)
  WHERE
    c.is_sales_comp = true
    AND c.property_price_total IS NOT NULL AND c.property_price_total > 0
    AND c.num_units IS NOT NULL AND c.num_units > 0
    AND c.sale_transaction_date IS NOT NULL
    AND c.latitude IS NOT NULL AND c.longitude IS NOT NULL
    AND mb.geoid = p_geoid
  GROUP BY 1
  ORDER BY 1;
$function$;

-- ══════════════════════════════════════════════════════════════════════════════
-- Map choropleth variants (get_map_crexi_sales_trends*)
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
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY c.property_price_total / c.num_units::numeric) AS median_price,
        COUNT(*)                                                                   AS n
    FROM crexi_api_comps c
    WHERE c.is_sales_comp = true
      AND c.property_price_total IS NOT NULL AND c.property_price_total > 0
      AND c.num_units IS NOT NULL AND c.num_units > 0
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
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY c.property_price_total / c.num_units::numeric) AS median_price,
        COUNT(*)                                                                   AS cnt
    FROM crexi_api_comps c
    JOIN neighborhoods n ON ST_Within(c.geom, n.geom)
    WHERE c.is_sales_comp = true
      AND c.property_price_total IS NOT NULL AND c.property_price_total > 0
      AND c.num_units IS NOT NULL AND c.num_units > 0
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
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY c.property_price_total / c.num_units::numeric) AS median_price,
        COUNT(*)                                                                   AS cnt
    FROM crexi_api_comps c
    JOIN city_boundaries cb
        ON lower(c.city)  = lower(cb.name)
        AND lower(c.state) = lower(cb.state)
    WHERE c.is_sales_comp = true
      AND c.property_price_total IS NOT NULL AND c.property_price_total > 0
      AND c.num_units IS NOT NULL AND c.num_units > 0
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
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY c.property_price_total / c.num_units::numeric) AS median_price,
        COUNT(*)                                                                   AS cnt
    FROM crexi_api_comps c
    JOIN county_boundaries cb ON ST_Within(c.geom, cb.geom)
    WHERE c.is_sales_comp = true
      AND c.property_price_total IS NOT NULL AND c.property_price_total > 0
      AND c.num_units IS NOT NULL AND c.num_units > 0
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
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY c.property_price_total / c.num_units::numeric) AS median_price,
        COUNT(*)                                                                   AS cnt
    FROM crexi_api_comps c
    JOIN msa_boundaries mb ON ST_Within(c.geom, mb.geom)
    WHERE c.is_sales_comp = true
      AND c.property_price_total IS NOT NULL AND c.property_price_total > 0
      AND c.num_units IS NOT NULL AND c.num_units > 0
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
