-- Fix ZIP+4 codes being silently dropped from the map choropleth ZIP variants.
--
-- The raw c.zip / d.address_zip fields in Crexi and LoopNet data include
-- ZIP+4 strings like "94110-1234". These form their own group-by buckets and
-- then fail to join against zip_codes (which only has 5-digit geometries),
-- so any comp with a ZIP+4 code is silently excluded from the ZIP map view.
-- The neighborhood/county/MSA variants capture all spatially-located comps
-- regardless of ZIP format, causing a systematic divergence between the two views.
--
-- Fix: use LEFT(zip, 5) when grouping and joining so all comps are bucketed
-- into their 5-digit ZIP regardless of whether they carry an extended code.

-- ── Crexi ZIP ────────────────────────────────────────────────────────────────

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

-- ── LoopNet ZIP ──────────────────────────────────────────────────────────────

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
        LEFT(d.address_zip, 5)                                                     AS z,
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
      AND d.address_zip IS NOT NULL AND LENGTH(d.address_zip) >= 5
      AND s.scraped_at::date >= b.window_start
    GROUP BY LEFT(d.address_zip, 5)
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
