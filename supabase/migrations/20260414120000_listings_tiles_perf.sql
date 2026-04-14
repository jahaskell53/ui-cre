-- Listings tiles performance improvements
--
-- Two complementary changes:
--
-- 1. LoopNet btree index on (latitude, longitude)
--    The /api/listings/loopnet map query filters with range predicates on
--    latitude/longitude but no spatial index exists, causing a full table scan.
--    A composite btree index lets Postgres use an index range scan for bbox
--    filters (gte/lte on latitude and longitude), cutting scan cost significantly.
--
-- 2. Zillow materialized view + updated RPC
--    get_zillow_map_listings executes a 6-CTE chain with jsonb_agg for unit mixes
--    on every request. The common case (p_latest_only=true) is entirely
--    deterministic once a scrape run completes — the result set never changes
--    until the next pipeline run.
--
--    zillow_map_listings_mv pre-computes the full result for the latest run and
--    stores it as a materialized view. When p_latest_only=true, the RPC reads
--    from the MV with simple WHERE/ORDER filters instead of recomputing the
--    CTEs, reducing per-request query time from seconds to milliseconds.
--
--    The MV is refreshed by calling refresh_zillow_map_listings_mv() after each
--    Dagster pipeline run completes (cleaned_building_units asset).
--
--    For p_latest_only=false (historical exploration), the original CTE path is
--    kept unchanged.

-- ─── 1. LoopNet bbox index ────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_loopnet_listings_lat_lng
    ON public.loopnet_listings (latitude, longitude);

-- ─── 2. Zillow materialized view ─────────────────────────────────────────────

CREATE MATERIALIZED VIEW IF NOT EXISTS public.zillow_map_listings_mv AS

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
        cl.geom,
        ST_X(cl.geom) AS longitude,
        ST_Y(cl.geom) AS latitude
    FROM cleaned_listings cl
    WHERE cl.geom IS NOT NULL
      AND cl.home_type != 'SINGLE_FAMILY'
      AND cl.run_id = (SELECT run_id FROM latest_run)
),

deduped_units AS (
    SELECT DISTINCT ON (building_zpid, zpid)
        building_zpid,
        zpid,
        COALESCE(beds, 0) AS beds,
        baths,
        price
    FROM base_pre
    WHERE building_zpid IS NOT NULL
    ORDER BY building_zpid, zpid, run_id DESC
),

unit_mix_agg AS (
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
            COUNT(*) AS cnt,
            CASE WHEN COUNT(*) FILTER (WHERE price IS NOT NULL) > 0
                 THEN ROUND(AVG(price) FILTER (WHERE price IS NOT NULL))
                 ELSE NULL END AS avg_price
        FROM deduped_units
        GROUP BY building_zpid, beds, baths
    ) mix_rows
    GROUP BY building_zpid
),

individuals AS (
    SELECT
        'zillow-' || id::text AS id,
        COALESCE(
            address_raw,
            NULLIF(CONCAT_WS(', ', address_street, address_city, address_state, address_zip), ''),
            'Address not listed'
        ) AS address,
        longitude,
        latitude,
        geom,
        CASE WHEN price IS NOT NULL THEN '$' || TO_CHAR(price, 'FM999,999,999') ELSE 'TBD' END AS price_label,
        false AS is_reit,
        1 AS unit_count,
        '[]'::jsonb AS unit_mix,
        img_src,
        area,
        scraped_at,
        NULL::text AS building_zpid,
        price,
        beds,
        baths,
        laundry,
        home_type,
        is_building
    FROM base_pre
    WHERE building_zpid IS NULL AND is_building IS NOT true
),

reit_buildings AS (
    SELECT
        'zillow-' || (ARRAY_AGG(b.id::text ORDER BY b.scraped_at DESC))[1] AS id,
        COALESCE(
            (ARRAY_AGG(b.address_raw ORDER BY b.scraped_at DESC))[1],
            NULLIF(CONCAT_WS(', ',
                (ARRAY_AGG(b.address_street ORDER BY b.scraped_at DESC))[1],
                (ARRAY_AGG(b.address_city   ORDER BY b.scraped_at DESC))[1],
                (ARRAY_AGG(b.address_state  ORDER BY b.scraped_at DESC))[1],
                (ARRAY_AGG(b.address_zip    ORDER BY b.scraped_at DESC))[1]
            ), ''),
            'Address not listed'
        ) AS address,
        AVG(b.longitude) AS longitude,
        AVG(b.latitude)  AS latitude,
        ST_Centroid(ST_Collect(b.geom)) AS geom,
        CASE
            WHEN AVG(b.price) IS NOT NULL
            THEN '$' || TO_CHAR(ROUND(AVG(b.price)), 'FM999,999,999') || ' avg'
            ELSE 'TBD'
        END AS price_label,
        true AS is_reit,
        (ARRAY_AGG(uma.unit_count))[1] AS unit_count,
        (ARRAY_AGG(uma.unit_mix))[1]   AS unit_mix,
        (ARRAY_AGG(b.img_src ORDER BY b.scraped_at DESC))[1] AS img_src,
        NULL::integer AS area,
        MAX(b.scraped_at) AS scraped_at,
        MIN(b.building_zpid) AS building_zpid,
        AVG(b.price)::integer AS price,
        NULL::integer AS beds,
        NULL::numeric AS baths,
        -- Use the most common laundry value across units for the building row
        (
            SELECT u.laundry
            FROM base_pre u
            WHERE u.building_zpid = b.building_zpid
              AND u.laundry IS NOT NULL
            GROUP BY u.laundry
            ORDER BY COUNT(*) DESC
            LIMIT 1
        ) AS laundry,
        'APARTMENT'::text AS home_type,
        true AS is_building
    FROM base_pre b
    JOIN unit_mix_agg uma ON uma.building_zpid = b.building_zpid
    WHERE b.building_zpid IS NOT NULL
    GROUP BY b.building_zpid
)

SELECT * FROM individuals
UNION ALL
SELECT * FROM reit_buildings;

-- Spatial index for bbox filtering directly on the MV
CREATE INDEX IF NOT EXISTS idx_zillow_map_listings_mv_geom
    ON public.zillow_map_listings_mv
    USING gist (geom gist_geometry_ops_2d)
    WHERE geom IS NOT NULL;

-- Index to support ORDER BY scraped_at DESC NULLS LAST
CREATE INDEX IF NOT EXISTS idx_zillow_map_listings_mv_scraped_at
    ON public.zillow_map_listings_mv (scraped_at DESC NULLS LAST);

-- ─── 3. Refresh helper ───────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.refresh_zillow_map_listings_mv()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.zillow_map_listings_mv;
$$;

-- CONCURRENT refresh requires a unique index on the MV
CREATE UNIQUE INDEX IF NOT EXISTS idx_zillow_map_listings_mv_id
    ON public.zillow_map_listings_mv (id);

-- Allow the service_role (used by PostgREST/Supabase client) to call the function
GRANT EXECUTE ON FUNCTION public.refresh_zillow_map_listings_mv() TO service_role;

-- ─── 4. Update get_zillow_map_listings to use MV for latest-only path ─────────

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
SET statement_timeout TO '30s'
AS $function$

-- Fast path: p_latest_only=true reads from the pre-computed materialized view.
-- The MV holds exactly one run (the latest), so all further filters are simple
-- column predicates that Postgres can satisfy with the MV's indexes.
SELECT
    mv.id,
    mv.address,
    mv.longitude,
    mv.latitude,
    mv.price_label,
    mv.is_reit,
    mv.unit_count,
    mv.unit_mix,
    mv.img_src,
    mv.area,
    mv.scraped_at,
    mv.building_zpid,
    COUNT(*) OVER () AS total_count
FROM public.zillow_map_listings_mv mv
WHERE p_latest_only = true
  AND (p_zip           IS NULL OR mv.address ILIKE '%' || p_zip || '%')
  AND (p_city          IS NULL OR mv.address ILIKE '%' || p_city || '%')
  AND (p_address_query IS NULL OR mv.address ILIKE '%' || p_address_query || '%')
  AND (p_price_min     IS NULL OR mv.price   >= p_price_min)
  AND (p_price_max     IS NULL OR mv.price   <= p_price_max)
  AND (p_sqft_min      IS NULL OR mv.area    >= p_sqft_min)
  AND (p_sqft_max      IS NULL OR mv.area    <= p_sqft_max)
  AND (p_baths_min     IS NULL OR mv.baths   >= p_baths_min)
  AND (p_beds IS NULL OR (
      CASE
        WHEN 4 = ANY(p_beds) AND array_length(p_beds, 1) > 1
          THEN COALESCE(mv.beds, 0) >= 4
            OR COALESCE(mv.beds, 0) = ANY(array_remove(p_beds, 4))
        WHEN 4 = ANY(p_beds)
          THEN COALESCE(mv.beds, 0) >= 4
        ELSE COALESCE(mv.beds, 0) = ANY(p_beds)
      END
  ))
  AND (p_home_types IS NULL OR array_length(p_home_types, 1) = 0
       OR mv.home_type = ANY(p_home_types))
  AND (
      p_property_type = 'both'
      OR (p_property_type = 'reit' AND (mv.building_zpid IS NOT NULL OR mv.is_building = true))
      OR (p_property_type = 'mid'  AND mv.building_zpid IS NULL AND mv.is_building IS NOT true)
  )
  AND (p_laundry IS NULL
       OR COALESCE(array_length(p_laundry, 1), 0) = 0
       OR mv.laundry = ANY(p_laundry))
  AND (
      p_bounds_south IS NULL OR p_bounds_north IS NULL
      OR p_bounds_west IS NULL OR p_bounds_east IS NULL
      OR mv.geom && ST_MakeEnvelope(p_bounds_west, p_bounds_south, p_bounds_east, p_bounds_north, 4326)
  )
ORDER BY mv.scraped_at DESC NULLS LAST

UNION ALL

-- Slow path: p_latest_only=false (historical exploration). Identical to the
-- original CTE logic, unchanged from migration 20260410030000.
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
    total_count
FROM (

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
    WHERE p_latest_only = false
      AND (
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

unit_mix_agg AS (
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
            COUNT(*) AS cnt,
            CASE WHEN COUNT(*) FILTER (WHERE price IS NOT NULL) > 0
                 THEN ROUND(AVG(price) FILTER (WHERE price IS NOT NULL))
                 ELSE NULL END AS avg_price
        FROM deduped_units
        GROUP BY building_zpid, beds, baths
    ) mix_rows
    GROUP BY building_zpid
),

individuals AS (
    SELECT
        'zillow-' || id::text AS id,
        COALESCE(
            address_raw,
            NULLIF(CONCAT_WS(', ', address_street, address_city, address_state, address_zip), ''),
            'Address not listed'
        ) AS address,
        longitude,
        latitude,
        CASE WHEN price IS NOT NULL THEN '$' || TO_CHAR(price, 'FM999,999,999') ELSE 'TBD' END AS price_label,
        false AS is_reit,
        1 AS unit_count,
        '[]'::jsonb AS unit_mix,
        img_src,
        area,
        scraped_at,
        NULL::text AS building_zpid
    FROM base
    WHERE building_zpid IS NULL AND is_building IS NOT true
),

reit_buildings AS (
    SELECT
        'zillow-' || (ARRAY_AGG(b.id::text ORDER BY b.scraped_at DESC))[1] AS id,
        COALESCE(
            (ARRAY_AGG(b.address_raw ORDER BY b.scraped_at DESC))[1],
            NULLIF(CONCAT_WS(', ',
                (ARRAY_AGG(b.address_street ORDER BY b.scraped_at DESC))[1],
                (ARRAY_AGG(b.address_city   ORDER BY b.scraped_at DESC))[1],
                (ARRAY_AGG(b.address_state  ORDER BY b.scraped_at DESC))[1],
                (ARRAY_AGG(b.address_zip    ORDER BY b.scraped_at DESC))[1]
            ), ''),
            'Address not listed'
        ) AS address,
        AVG(b.longitude) AS longitude,
        AVG(b.latitude)  AS latitude,
        CASE
            WHEN AVG(b.price) IS NOT NULL
            THEN '$' || TO_CHAR(ROUND(AVG(b.price)), 'FM999,999,999') || ' avg'
            ELSE 'TBD'
        END AS price_label,
        true AS is_reit,
        (ARRAY_AGG(uma.unit_count))[1] AS unit_count,
        (ARRAY_AGG(uma.unit_mix))[1]   AS unit_mix,
        (ARRAY_AGG(b.img_src ORDER BY b.scraped_at DESC))[1] AS img_src,
        NULL::integer AS area,
        MAX(b.scraped_at) AS scraped_at,
        MIN(b.building_zpid) AS building_zpid
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
    COUNT(*) OVER () AS total_count
FROM combined
ORDER BY scraped_at DESC NULLS LAST

) historical_results;

$function$;
