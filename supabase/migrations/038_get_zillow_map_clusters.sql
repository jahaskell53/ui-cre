-- Server-side spatial clustering for the map at low zoom levels.
--
-- At zoom <= 11 the client-side Mapbox clustering collapses 12k+ rows into
-- ~30 circles anyway. Returning individual rows is wasteful and can exceed
-- the 8s PostgREST statement timeout for large viewports.
--
-- This function aggregates listings into a spatial grid and returns one row
-- per occupied cell with a point count and average price. The grid resolution
-- (p_grid_step, in degrees) is set by the caller based on the current zoom.
--
-- Typical output is 50–200 rows instead of 4k–12k, which eliminates the
-- timeout and reduces payload size by ~98%.
CREATE OR REPLACE FUNCTION public.get_zillow_map_clusters(
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
    p_bounds_east    double precision DEFAULT NULL,
    p_grid_step      double precision DEFAULT 0.05
)
RETURNS TABLE (
    lat          double precision,
    lng          double precision,
    point_count  integer,
    avg_price    integer
)
LANGUAGE sql
STABLE
AS $function$

WITH latest_run AS (
    SELECT run_id
    FROM cleaned_listings
    ORDER BY run_id DESC
    LIMIT 1
)
SELECT
    FLOOR(ST_Y(cl.geom) / p_grid_step) * p_grid_step + p_grid_step / 2  AS lat,
    FLOOR(ST_X(cl.geom) / p_grid_step) * p_grid_step + p_grid_step / 2  AS lng,
    COUNT(*)::integer                                                     AS point_count,
    CASE WHEN COUNT(*) FILTER (WHERE cl.price IS NOT NULL) > 0
         THEN ROUND(AVG(cl.price) FILTER (WHERE cl.price IS NOT NULL))::integer
         ELSE NULL END                                                    AS avg_price
FROM cleaned_listings cl
WHERE cl.geom IS NOT NULL
  AND cl.home_type != 'SINGLE_FAMILY'
  AND (NOT p_latest_only OR cl.run_id = (SELECT run_id FROM latest_run))
  AND (p_zip           IS NULL OR cl.address_zip   =     p_zip)
  AND (p_city          IS NULL OR cl.address_city ILIKE '%' || p_city || '%')
  AND (p_address_query IS NULL OR (
          cl.address_raw   ILIKE '%' || p_address_query || '%'
       OR cl.address_city  ILIKE '%' || p_address_query || '%'
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
GROUP BY FLOOR(ST_Y(cl.geom) / p_grid_step), FLOOR(ST_X(cl.geom) / p_grid_step);

$function$;
