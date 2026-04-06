-- RPC: get_zillow_map_listings
--
-- Returns one row per map listing (one per individual unit, one per REIT
-- building). REIT units sharing a building_zpid are grouped in SQL, so the
-- caller never receives more rows than there are visual pins on the map.
-- unit_mix is a JSONB array of {beds, baths, count, avg_price} for buildings,
-- and an empty array for individual listings.
-- total_count is a window count of the rows returned by this call.
--
-- Parameters mirror the full set of filters on the analytics map page.

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
    p_property_type  text    DEFAULT 'both',   -- 'both' | 'reit' | 'mid'
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
    -- Resolve the latest run_id once, used only when p_latest_only is true.
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
        ST_X(cl.geom) AS longitude,
        ST_Y(cl.geom) AS latitude
    FROM cleaned_listings cl
    WHERE cl.geom IS NOT NULL
      AND cl.home_type != 'SINGLE_FAMILY'

      -- latest-only filter
      AND (NOT p_latest_only OR cl.run_id = (SELECT run_id FROM latest_run))

      -- area filters (mutually exclusive; county falls back to bbox only)
      AND (p_zip           IS NULL OR cl.address_zip   =     p_zip)
      AND (p_city          IS NULL OR cl.address_city ILIKE '%' || p_city || '%')
      AND (p_address_query IS NULL OR (
              cl.address_raw  ILIKE '%' || p_address_query || '%'
           OR cl.address_city ILIKE '%' || p_address_query || '%'
           OR cl.address_state ILIKE '%' || p_address_query || '%'
      ))

      -- numeric filters
      AND (p_price_min  IS NULL OR cl.price >= p_price_min)
      AND (p_price_max  IS NULL OR cl.price <= p_price_max)
      AND (p_sqft_min   IS NULL OR cl.area  >= p_sqft_min)
      AND (p_sqft_max   IS NULL OR cl.area  <= p_sqft_max)
      AND (p_baths_min  IS NULL OR cl.baths >= p_baths_min)

      -- beds: exact values < 4, or 4+ bucket
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

      -- home type whitelist
      AND (p_home_types IS NULL OR array_length(p_home_types, 1) = 0
           OR cl.home_type = ANY(p_home_types))

      -- property type: reit | mid | both
      AND (
          p_property_type = 'both'
          OR (p_property_type = 'reit' AND (cl.building_zpid IS NOT NULL OR cl.is_building = true))
          OR (p_property_type = 'mid'  AND cl.building_zpid IS NULL AND cl.is_building IS NOT true)
      )

      -- bbox
      AND (p_bounds_south IS NULL OR ST_Y(cl.geom) >= p_bounds_south)
      AND (p_bounds_north IS NULL OR ST_Y(cl.geom) <= p_bounds_north)
      AND (p_bounds_west  IS NULL OR ST_X(cl.geom) >= p_bounds_west)
      AND (p_bounds_east  IS NULL OR ST_X(cl.geom) <= p_bounds_east)
),

individuals AS (
    -- Non-REIT: one row per listing
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
    -- REIT: group all units under the same building_zpid into one row
    SELECT
        'zillow-' || (ARRAY_AGG(id::text ORDER BY scraped_at DESC))[1]   AS id,
        COALESCE(
            (ARRAY_AGG(address_raw ORDER BY scraped_at DESC))[1],
            NULLIF(CONCAT_WS(', ',
                (ARRAY_AGG(address_street ORDER BY scraped_at DESC))[1],
                (ARRAY_AGG(address_city   ORDER BY scraped_at DESC))[1],
                (ARRAY_AGG(address_state  ORDER BY scraped_at DESC))[1],
                (ARRAY_AGG(address_zip    ORDER BY scraped_at DESC))[1]
            ), ''),
            'Address not listed'
        )                                                                  AS address,
        AVG(longitude)                                                     AS longitude,
        AVG(latitude)                                                      AS latitude,
        CASE
            WHEN AVG(price) IS NOT NULL
            THEN '$' || TO_CHAR(ROUND(AVG(price)), 'FM999,999,999') || ' avg'
            ELSE 'TBD'
        END                                                                AS price_label,
        true                                                               AS is_reit,
        COUNT(*)::integer                                                  AS unit_count,
        -- unit_mix: [{beds, baths, count, avg_price}] sorted by beds, baths
        (
            SELECT COALESCE(jsonb_agg(mix ORDER BY mix->>'beds', mix->>'baths'), '[]'::jsonb)
            FROM (
                SELECT jsonb_build_object(
                    'beds',      COALESCE(beds, 0),
                    'baths',     baths,
                    'count',     COUNT(*),
                    'avg_price', CASE WHEN COUNT(*) FILTER (WHERE price IS NOT NULL) > 0
                                      THEN ROUND(AVG(price) FILTER (WHERE price IS NOT NULL))
                                      ELSE NULL END
                ) AS mix
                FROM base b2
                WHERE b2.building_zpid = base.building_zpid
                GROUP BY COALESCE(b2.beds, 0), b2.baths
            ) sub
        )                                                                  AS unit_mix,
        (ARRAY_AGG(img_src ORDER BY scraped_at DESC))[1]                  AS img_src,
        NULL::integer                                                      AS area,
        MAX(scraped_at)                                                    AS scraped_at
    FROM base
    WHERE building_zpid IS NOT NULL
    GROUP BY building_zpid
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
