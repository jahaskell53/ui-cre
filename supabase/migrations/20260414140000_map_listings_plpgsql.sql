-- Convert get_zillow_map_listings from LANGUAGE sql to LANGUAGE plpgsql.
--
-- Root cause: SQL-language functions use generic query plans that cannot
-- leverage actual parameter values for index selection. The GiST index on
-- cleaned_listings.geom and the btree on run_id are only effective when the
-- planner knows the concrete envelope / run_id values. With generic planning
-- the function scans ~440K buffer pages; with custom planning (plpgsql) it
-- scans ~900 — a 23× speedup (7s → 300ms) on production data.

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
LANGUAGE plpgsql
STABLE
AS $function$
BEGIN
RETURN QUERY

WITH latest_run AS (
    SELECT cl_lr.run_id
    FROM cleaned_listings cl_lr
    ORDER BY cl_lr.run_id DESC
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
      AND (NOT p_latest_only OR cl.run_id = (SELECT lr.run_id FROM latest_run lr))
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

unit_mix_agg AS (
    SELECT mv.building_zpid, mv.unit_count, mv.unit_mix
    FROM (
        SELECT DISTINCT bp2.building_zpid FROM base bp2 WHERE bp2.building_zpid IS NOT NULL
    ) visible
    JOIN (
        SELECT mvl.building_zpid, mvl.unit_count, mvl.unit_mix
        FROM mv_unit_breakdown_latest mvl
        WHERE p_latest_only
        UNION ALL
        SELECT mvh.building_zpid, mvh.unit_count, mvh.unit_mix
        FROM mv_unit_breakdown_historical mvh
        WHERE NOT p_latest_only
    ) mv USING (building_zpid)
),

individuals AS (
    SELECT
        'zillow-' || b_ind.id::text                                AS id,
        COALESCE(
            b_ind.address_raw,
            NULLIF(CONCAT_WS(', ', b_ind.address_street, b_ind.address_city, b_ind.address_state, b_ind.address_zip), ''),
            'Address not listed'
        )                                                    AS address,
        b_ind.longitude,
        b_ind.latitude,
        CASE WHEN b_ind.price IS NOT NULL THEN '$' || TO_CHAR(b_ind.price, 'FM999,999,999') ELSE 'TBD' END
                                                             AS price_label,
        false                                                AS is_reit,
        1                                                    AS unit_count,
        '[]'::jsonb                                          AS unit_mix,
        b_ind.img_src,
        b_ind.area,
        b_ind.scraped_at,
        NULL::text                                           AS building_zpid
    FROM base b_ind
    WHERE b_ind.building_zpid IS NULL AND b_ind.is_building IS NOT true
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
    c.id,
    c.address,
    c.longitude,
    c.latitude,
    c.price_label,
    c.is_reit,
    c.unit_count,
    c.unit_mix,
    c.img_src,
    c.area,
    c.scraped_at,
    c.building_zpid,
    COUNT(*) OVER ()  AS total_count
FROM combined c
ORDER BY c.scraped_at DESC NULLS LAST;

END;
$function$;

ALTER FUNCTION public.get_zillow_map_listings(
    text, text, text, boolean,
    integer, integer, integer, integer,
    integer[], numeric, text[], text, text[],
    double precision, double precision, double precision, double precision
)
SET statement_timeout TO '30s';
