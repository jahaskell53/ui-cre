-- Drop the stale 16-argument overload (no p_laundry) that causes PostgREST
-- PGRST203 ambiguity errors alongside the 17-arg laundry overload from
-- migration 038_zillow_map_listings_laundry_filter.
DROP FUNCTION IF EXISTS public.get_zillow_map_listings(
    text, text, text, boolean,
    integer, integer, integer, integer,
    integer[], numeric, text[], text,
    double precision, double precision, double precision, double precision
);

-- Refine REIT unit counting to support both current and historical modes.
--
-- The 17-arg laundry version from migration 038_zillow_map_listings_laundry_filter
-- still uses COUNT(*) for unit_count, which inflates counts when p_latest_only=false
-- because it counts the same units once per scrape run.
--
-- This migration replaces the function with a DISTINCT ON (building_zpid, zpid)
-- deduplication CTE that handles both modes correctly and consistently:
--
--   p_latest_only = true  → base contains only the latest run's rows, so
--                           DISTINCT ON is a no-op: one row per zpid anyway.
--                           unit_count = current inventory size.
--
--   p_latest_only = false → base contains all historical runs. DISTINCT ON
--                           keeps the most-recent row per zpid (ORDER BY
--                           run_id DESC). unit_count = COUNT(DISTINCT zpid)
--                           across all history. Shows every unique unit ever
--                           scraped for the building.
--
-- Preserves all parameters and output columns from the laundry migration,
-- including p_laundry and the building_zpid return column.
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

-- Apply all filters except laundry first, then filter by laundry below.
-- REIT laundry filtering matches any unit in the building with the right
-- laundry type (same logic as the laundry migration baseline).
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

-- Deduplicate unit rows to one row per (building_zpid, zpid), keeping the
-- most-recent run's data. This eliminates cross-run inflation in both modes:
--
--   p_latest_only=true  → base has one run, DISTINCT ON is a no-op.
--   p_latest_only=false → base has all runs, DISTINCT ON keeps the latest
--                         price/beds/baths for each unique zpid.
deduped_units AS (
    SELECT DISTINCT ON (building_zpid, zpid)
        building_zpid,
        zpid,
        COALESCE(beds, 0) AS beds,
        baths,
        price
    FROM base
    WHERE building_zpid IS NOT NULL
    ORDER BY building_zpid, zpid, run_id DESC
),

-- Aggregate unit_mix and unit_count from the deduplicated unit set.
unit_mix_agg AS (
    SELECT
        building_zpid,
        SUM(cnt)::integer                                                     AS unit_count,
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
        )                                                                     AS unit_mix
    FROM (
        SELECT
            building_zpid,
            beds,
            baths,
            COUNT(*)                                                           AS cnt,
            CASE WHEN COUNT(*) FILTER (WHERE price IS NOT NULL) > 0
                 THEN ROUND(AVG(price) FILTER (WHERE price IS NOT NULL))
                 ELSE NULL END                                                 AS avg_price
        FROM deduped_units
        GROUP BY building_zpid, beds, baths
    ) mix_rows
    GROUP BY building_zpid
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
