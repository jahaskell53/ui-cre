-- Materialized views for unit breakdown by building.
--
-- OPE-116: Replace the inline deduped_units + unit_mix_agg CTEs in
-- get_zillow_map_listings with two pre-computed materialized views so that
-- the unit aggregation cost is paid once (on REFRESH) rather than on every
-- map request.
--
-- Two views are created to match the two query modes supported by the RPC:
--
--   mv_unit_breakdown_latest
--     Unit mix for the single most-recent run_id only.
--     Refreshed after each pipeline run.
--     Matches p_latest_only = true.
--
--   mv_unit_breakdown_historical
--     Unit mix across all runs, deduplicated per zpid to one row per building.
--     Refreshed after each pipeline run.
--     Matches p_latest_only = false (the default).
--
-- On the index question (OPE-116):
--   idx_cleaned_listings_building_zpid_zpid_run stays. It is still needed:
--     (a) by REFRESH MATERIALIZED VIEW (DISTINCT ON uses it),
--     (b) by the cleaned/route.ts Drizzle query that fetches units for a
--         building detail page (WHERE building_zpid = $1 ORDER BY run_id DESC).
--
-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Latest-only view
-- ─────────────────────────────────────────────────────────────────────────────

CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_unit_breakdown_latest AS
WITH latest_run AS (
    SELECT run_id
    FROM public.cleaned_listings
    ORDER BY run_id DESC
    LIMIT 1
),
deduped AS (
    SELECT DISTINCT ON (building_zpid, zpid)
        building_zpid,
        zpid,
        COALESCE(beds, 0) AS beds,
        baths,
        price
    FROM public.cleaned_listings
    WHERE building_zpid IS NOT NULL
      AND run_id = (SELECT run_id FROM latest_run)
    ORDER BY building_zpid, zpid, run_id DESC
)
SELECT
    building_zpid,
    SUM(cnt)::integer AS unit_count,
    COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'beds',      beds,
                'baths',     baths,
                'count',     cnt,
                'avg_price', avg_price
            )
            ORDER BY beds, baths
        ),
        '[]'::jsonb
    ) AS unit_mix
FROM (
    SELECT
        building_zpid,
        beds,
        baths,
        COUNT(*)                                                           AS cnt,
        CASE WHEN COUNT(*) FILTER (WHERE price IS NOT NULL) > 0
             THEN ROUND(AVG(price) FILTER (WHERE price IS NOT NULL))
             ELSE NULL END                                                 AS avg_price
    FROM deduped
    GROUP BY building_zpid, beds, baths
) mix_rows
GROUP BY building_zpid
WITH NO DATA;

-- Unique index required for REFRESH CONCURRENTLY and for the JOIN in the RPC.
CREATE UNIQUE INDEX IF NOT EXISTS mv_unit_breakdown_latest_building_zpid_idx
    ON public.mv_unit_breakdown_latest (building_zpid);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Historical (all-runs) view
-- ─────────────────────────────────────────────────────────────────────────────

CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_unit_breakdown_historical AS
WITH deduped AS (
    SELECT DISTINCT ON (building_zpid, zpid)
        building_zpid,
        zpid,
        COALESCE(beds, 0) AS beds,
        baths,
        price
    FROM public.cleaned_listings
    WHERE building_zpid IS NOT NULL
    ORDER BY building_zpid, zpid, run_id DESC
)
SELECT
    building_zpid,
    SUM(cnt)::integer AS unit_count,
    COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'beds',      beds,
                'baths',     baths,
                'count',     cnt,
                'avg_price', avg_price
            )
            ORDER BY beds, baths
        ),
        '[]'::jsonb
    ) AS unit_mix
FROM (
    SELECT
        building_zpid,
        beds,
        baths,
        COUNT(*)                                                           AS cnt,
        CASE WHEN COUNT(*) FILTER (WHERE price IS NOT NULL) > 0
             THEN ROUND(AVG(price) FILTER (WHERE price IS NOT NULL))
             ELSE NULL END                                                 AS avg_price
    FROM deduped
    GROUP BY building_zpid, beds, baths
) mix_rows
GROUP BY building_zpid
WITH NO DATA;

-- Unique index required for REFRESH CONCURRENTLY and for the JOIN in the RPC.
CREATE UNIQUE INDEX IF NOT EXISTS mv_unit_breakdown_historical_building_zpid_idx
    ON public.mv_unit_breakdown_historical (building_zpid);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Initial population
-- ─────────────────────────────────────────────────────────────────────────────

REFRESH MATERIALIZED VIEW public.mv_unit_breakdown_latest;
REFRESH MATERIALIZED VIEW public.mv_unit_breakdown_historical;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Replace get_zillow_map_listings to read from the materialized views
-- ─────────────────────────────────────────────────────────────────────────────
--
-- The unit_mix_agg and deduped_units CTEs are replaced by a JOIN against
-- the appropriate pre-computed view. The rest of the RPC (base_pre, base,
-- individuals, reit_buildings, combined) is unchanged.

CREATE OR REPLACE FUNCTION public.get_zillow_map_listings(
    p_zip            text    DEFAULT NULL,
    p_city           text    DEFAULT NULL,
    p_address_query  text    DEFAULT NULL,
    p_latest_only    boolean DEFAULT false,
    p_price_min      integer DEFAULT NULL,
    p_price_max      integer DEFAULT NULL,
    p_sqft_min       integer DEFAULT NULL,
    p_sqft_max       integer DEFAULT NULL,
    p_beds           integer[] DEFAULT NULL,
    p_baths_min      numeric DEFAULT NULL,
    p_home_types     text[]  DEFAULT NULL,
    p_property_type  text    DEFAULT 'both',
    p_laundry        text[]  DEFAULT NULL,
    p_bounds_south   double precision DEFAULT NULL,
    p_bounds_north   double precision DEFAULT NULL,
    p_bounds_west    double precision DEFAULT NULL,
    p_bounds_east    double precision DEFAULT NULL
)
RETURNS TABLE (
    id             text,
    address        text,
    longitude      double precision,
    latitude       double precision,
    price_label    text,
    is_reit        boolean,
    unit_count     integer,
    unit_mix       jsonb,
    img_src        text,
    area           integer,
    scraped_at     timestamptz,
    building_zpid  text,
    total_count    bigint
)
LANGUAGE sql
STABLE
AS $function$

WITH latest_run AS (
    SELECT run_id
    FROM cleaned_listings
    ORDER BY run_id DESC
    LIMIT 1
),

base_pre AS (
    SELECT
        cl.id,
        cl.address_raw,
        cl.address_street,
        cl.address_city,
        cl.address_state,
        cl.address_zip,
        cl.price,
        cl.area,
        cl.beds,
        cl.baths,
        cl.home_type,
        cl.building_zpid,
        cl.zpid,
        cl.is_building,
        cl.img_src,
        cl.scraped_at,
        cl.laundry,
        cl.run_id,
        ST_X(cl.geom) AS longitude,
        ST_Y(cl.geom) AS latitude
    FROM cleaned_listings cl
    WHERE cl.geom IS NOT NULL
      AND cl.home_type != 'SINGLE_FAMILY'
      AND (NOT p_latest_only OR cl.run_id = (SELECT run_id FROM latest_run))
      AND (p_zip           IS NULL OR cl.address_zip   =     p_zip)
      AND (p_city          IS NULL OR cl.address_city ILIKE '%' || p_city || '%')
      AND (p_address_query IS NULL OR (
              cl.address_raw  ILIKE '%' || p_address_query || '%'
           OR cl.address_city ILIKE '%' || p_address_query || '%'
           OR cl.address_state ILIKE '%' || p_address_query || '%'
      ))
      AND (p_price_min  IS NULL OR cl.price >= p_price_min)
      AND (p_price_max  IS NULL OR cl.price <= p_price_max)
      AND (p_sqft_min   IS NULL OR cl.area  >= p_sqft_min)
      AND (p_sqft_max   IS NULL OR cl.area  <= p_sqft_max)
      AND (p_baths_min  IS NULL OR cl.baths >= p_baths_min)
      AND (p_beds IS NULL OR (
          CASE
            WHEN 4 = ANY(p_beds) AND array_length(p_beds, 1) > 1
              THEN COALESCE(cl.beds, 0) >= 4
                OR COALESCE(cl.beds, 0) = ANY(array_remove(p_beds, 4))
            WHEN 4 = ANY(p_beds)
              THEN COALESCE(cl.beds, 0) >= 4
            ELSE COALESCE(cl.beds, 0) = ANY(p_beds)
          END
      ))
      AND (p_home_types IS NULL OR array_length(p_home_types, 1) = 0
           OR cl.home_type = ANY(p_home_types))
      AND (
          p_property_type = 'both'
          OR (p_property_type = 'reit' AND (cl.building_zpid IS NOT NULL OR cl.is_building = true))
          OR (p_property_type = 'mid'  AND cl.building_zpid IS NULL AND cl.is_building IS NOT true)
      )
      AND (
          p_bounds_south IS NULL OR p_bounds_north IS NULL
          OR p_bounds_west IS NULL OR p_bounds_east IS NULL
          OR cl.geom && ST_MakeEnvelope(p_bounds_west, p_bounds_south, p_bounds_east, p_bounds_north, 4326)
      )
),

base AS (
    SELECT *
    FROM base_pre bp
    WHERE (
        p_laundry IS NULL
        OR COALESCE(array_length(p_laundry, 1), 0) = 0
        OR (
            (bp.building_zpid IS NULL AND bp.is_building IS NOT true AND bp.laundry = ANY(p_laundry))
            OR (
                bp.building_zpid IS NOT NULL
                AND EXISTS (
                    SELECT 1
                    FROM base_pre u
                    WHERE u.building_zpid = bp.building_zpid
                      AND u.laundry = ANY(p_laundry)
                )
            )
            OR (bp.is_building = true AND bp.laundry = ANY(p_laundry))
        )
    )
),

-- Join against the appropriate pre-computed materialized view instead of
-- computing deduped_units + unit_mix_agg inline on every request.
unit_mix_agg AS (
    SELECT mv.building_zpid, mv.unit_count, mv.unit_mix
    FROM (
        SELECT DISTINCT building_zpid FROM base WHERE building_zpid IS NOT NULL
    ) visible
    JOIN (
        SELECT building_zpid, unit_count, unit_mix
        FROM mv_unit_breakdown_latest
        WHERE p_latest_only
        UNION ALL
        SELECT building_zpid, unit_count, unit_mix
        FROM mv_unit_breakdown_historical
        WHERE NOT p_latest_only
    ) mv USING (building_zpid)
),

individuals AS (
    SELECT
        'zillow-' || id::text                                AS id,
        COALESCE(
            address_raw,
            NULLIF(CONCAT_WS(', ', address_street, address_city, address_state, address_zip), ''),
            'Address not listed'
        )                                                    AS address,
        longitude,
        latitude,
        CASE WHEN price IS NOT NULL THEN '$' || TO_CHAR(price, 'FM999,999,999') ELSE 'TBD' END
                                                             AS price_label,
        false                                                AS is_reit,
        1                                                    AS unit_count,
        '[]'::jsonb                                          AS unit_mix,
        img_src,
        area,
        scraped_at,
        NULL::text                                           AS building_zpid
    FROM base
    WHERE building_zpid IS NULL AND is_building IS NOT true
),

reit_buildings AS (
    SELECT
        'zillow-' || (ARRAY_AGG(b.id::text ORDER BY b.scraped_at DESC))[1]   AS id,
        COALESCE(
            (ARRAY_AGG(b.address_raw ORDER BY b.scraped_at DESC))[1],
            NULLIF(CONCAT_WS(', ',
                (ARRAY_AGG(b.address_street ORDER BY b.scraped_at DESC))[1],
                (ARRAY_AGG(b.address_city   ORDER BY b.scraped_at DESC))[1],
                (ARRAY_AGG(b.address_state  ORDER BY b.scraped_at DESC))[1],
                (ARRAY_AGG(b.address_zip    ORDER BY b.scraped_at DESC))[1]
            ), ''),
            'Address not listed'
        )                                                                      AS address,
        AVG(b.longitude)                                                       AS longitude,
        AVG(b.latitude)                                                        AS latitude,
        CASE
            WHEN AVG(b.price) IS NOT NULL
            THEN '$' || TO_CHAR(ROUND(AVG(b.price)), 'FM999,999,999') || ' avg'
            ELSE 'TBD'
        END                                                                    AS price_label,
        true                                                                   AS is_reit,
        (ARRAY_AGG(uma.unit_count))[1]                                         AS unit_count,
        (ARRAY_AGG(uma.unit_mix))[1]                                           AS unit_mix,
        (ARRAY_AGG(b.img_src ORDER BY b.scraped_at DESC))[1]                  AS img_src,
        NULL::integer                                                          AS area,
        MAX(b.scraped_at)                                                      AS scraped_at,
        MIN(b.building_zpid)                                                   AS building_zpid
    FROM base b
    JOIN unit_mix_agg uma ON uma.building_zpid = b.building_zpid
    WHERE b.building_zpid IS NOT NULL
    GROUP BY b.building_zpid
),

combined AS (
    SELECT * FROM individuals
    UNION ALL
    SELECT * FROM reit_buildings
)

SELECT
    id,
    address,
    longitude,
    latitude,
    price_label,
    is_reit,
    unit_count,
    unit_mix,
    img_src,
    area,
    scraped_at,
    building_zpid,
    COUNT(*) OVER ()  AS total_count
FROM combined
ORDER BY scraped_at DESC NULLS LAST;

$function$;

-- Re-apply the 30s statement_timeout that was set in migration
-- 20260410040000_zillow_map_listings_statement_timeout.sql. CREATE OR REPLACE
-- resets proconfig, so we must set it again.
ALTER FUNCTION public.get_zillow_map_listings(
    text, text, text, boolean,
    integer, integer, integer, integer,
    integer[], numeric, text[], text, text[],
    double precision, double precision, double precision, double precision
)
SET statement_timeout TO '30s';
