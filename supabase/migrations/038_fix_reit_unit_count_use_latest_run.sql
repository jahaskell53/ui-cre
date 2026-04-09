-- Drop the stale 18-argument overload (p_limit, p_offset) that is no longer used
-- by the application and that causes PostgREST PGRST203 ambiguity errors.
DROP FUNCTION IF EXISTS public.get_zillow_map_listings(
    text, text, text, boolean,
    integer, integer, integer, integer,
    integer[], numeric, text[], text,
    double precision, double precision, double precision, double precision,
    integer, integer
);

-- Fix inflated unit_count and unit_mix for REIT buildings when p_latest_only=false.
--
-- Root cause: get_zillow_map_listings without p_latest_only includes unit rows from
-- ALL historical scrape runs. Since the pipeline inserts a fresh set of unit rows per
-- building on every scrape run, COUNT(*) in reit_buildings multiplied the true unit
-- count by the number of historical runs. A building with 50 actual units scraped 10
-- times showed unit_count=500.
--
-- Fix: add a latest_unit_run CTE that finds the most recent run_id per building
-- present in base, then restrict unit_mix_agg (and therefore unit_count) to only
-- those rows. p_latest_only continues to control which buildings appear as map pins
-- (unchanged); unit counts now always reflect the building's current inventory.
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
    p_bounds_south   double precision DEFAULT NULL,
    p_bounds_north   double precision DEFAULT NULL,
    p_bounds_west    double precision DEFAULT NULL,
    p_bounds_east    double precision DEFAULT NULL
)
RETURNS TABLE (
    id           text,
    address      text,
    longitude    double precision,
    latitude     double precision,
    price_label  text,
    is_reit      boolean,
    unit_count   integer,
    unit_mix     jsonb,
    img_src      text,
    area         integer,
    scraped_at   timestamptz,
    total_count  bigint
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

base AS (
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
        cl.is_building,
        cl.img_src,
        cl.scraped_at,
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

-- The most recent run_id for each building that appears in base.
-- Used to pin unit counts to current inventory regardless of p_latest_only.
latest_unit_run AS (
    SELECT building_zpid, MAX(run_id) AS run_id
    FROM base
    WHERE building_zpid IS NOT NULL
    GROUP BY building_zpid
),

-- Pre-aggregate unit_mix and total unit_count per building_zpid in a single
-- pass, restricted to the latest run per building to avoid historical inflation.
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
            b.building_zpid,
            COALESCE(b.beds, 0)                                               AS beds,
            b.baths,
            COUNT(*)                                                           AS cnt,
            CASE WHEN COUNT(*) FILTER (WHERE b.price IS NOT NULL) > 0
                 THEN ROUND(AVG(b.price) FILTER (WHERE b.price IS NOT NULL))
                 ELSE NULL END                                                 AS avg_price
        FROM base b
        JOIN latest_unit_run lur
          ON lur.building_zpid = b.building_zpid AND lur.run_id = b.run_id
        GROUP BY b.building_zpid, COALESCE(b.beds, 0), b.baths
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
        scraped_at
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
        -- unit_count from unit_mix_agg is based on latest-run-only rows so
        -- historical duplicates do not inflate the count.
        (ARRAY_AGG(uma.unit_count))[1]                                         AS unit_count,
        (ARRAY_AGG(uma.unit_mix))[1]                                           AS unit_mix,
        (ARRAY_AGG(b.img_src ORDER BY b.scraped_at DESC))[1]                  AS img_src,
        NULL::integer                                                          AS area,
        MAX(b.scraped_at)                                                      AS scraped_at
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
    COUNT(*) OVER ()  AS total_count
FROM combined
ORDER BY scraped_at DESC NULLS LAST;

$function$;
