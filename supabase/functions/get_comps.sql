CREATE OR REPLACE FUNCTION public.get_comps(
  subject_lng double precision,
  subject_lat double precision,
  radius_m double precision DEFAULT 3218,
  subject_price integer DEFAULT NULL::integer,
  subject_beds integer DEFAULT NULL::integer,
  subject_baths numeric DEFAULT NULL::numeric,
  subject_area integer DEFAULT NULL::integer,
  p_limit integer DEFAULT 10,
  area_tolerance numeric DEFAULT 0.15,
  include_reits boolean DEFAULT false,
  p_neighborhood_id integer DEFAULT NULL::integer,
  p_subject_zip text DEFAULT NULL::text,
  p_expand_adjacent boolean DEFAULT false,
  p_neighborhood_ids integer[] DEFAULT NULL::integer[]
)
 RETURNS TABLE(id uuid, address_raw text, address_street text, address_city text, address_state text, address_zip text, price integer, beds integer, baths numeric, area integer, distance_m double precision, composite_score double precision, building_zpid text, unit_count integer)
 LANGUAGE sql
AS $function$
  WITH neighborhood_geom AS (
    SELECT
      CASE
        WHEN p_expand_adjacent AND p_neighborhood_id IS NOT NULL THEN (
          SELECT ST_Union(n.geom)
          FROM neighborhoods n
          WHERE ST_DWithin(
            n.geom::geography,
            (SELECT geom FROM neighborhoods WHERE id = p_neighborhood_id)::geography,
            100
          )
        )
        ELSE (SELECT geom FROM neighborhoods WHERE id = p_neighborhood_id)
      END AS geom
  ),
  -- Deduplicate by zpid, keeping the most recently scraped row
  deduped AS (
    SELECT DISTINCT ON (zpid)
      id, address_raw, address_street, address_city, address_state, address_zip,
      price, beds, baths, area, building_zpid, geom, is_sfr, is_building
    FROM cleaned_listings
    ORDER BY zpid, scraped_at DESC NULLS LAST
  ),
  candidates AS (
    SELECT
      cl.id,
      cl.address_raw,
      cl.address_street,
      cl.address_city,
      cl.address_state,
      cl.address_zip,
      cl.price,
      COALESCE(cl.beds, 0) AS beds,
      cl.baths,
      cl.area,
      cl.building_zpid,
      ST_Distance(
        ST_SetSRID(ST_Point(subject_lng, subject_lat), 4326)::geography,
        cl.geom::geography
      ) AS distance_m
    FROM deduped cl
    WHERE cl.is_sfr IS NOT TRUE
      AND (include_reits OR cl.building_zpid IS NULL)
      AND cl.is_building IS NOT TRUE
      AND cl.geom  IS NOT NULL
      AND cl.price IS NOT NULL
      AND (
        (p_neighborhood_ids IS NOT NULL AND ST_Within(
            cl.geom,
            (SELECT ST_Union(geom) FROM neighborhoods WHERE id = ANY(p_neighborhood_ids))
        ))
        OR (p_neighborhood_ids IS NULL AND p_neighborhood_id IS NOT NULL AND ST_Within(
            cl.geom,
            (SELECT geom FROM neighborhood_geom)
        ))
        OR (p_neighborhood_ids IS NULL AND p_neighborhood_id IS NULL AND p_subject_zip IS NOT NULL
            AND cl.address_zip = p_subject_zip)
        OR (p_neighborhood_ids IS NULL AND p_neighborhood_id IS NULL AND p_subject_zip IS NULL AND ST_DWithin(
            ST_SetSRID(ST_Point(subject_lng, subject_lat), 4326)::geography,
            cl.geom::geography,
            radius_m
        ))
      )
      AND (subject_beds  IS NULL OR COALESCE(cl.beds, 0) = subject_beds)
      AND (subject_baths IS NULL OR cl.baths BETWEEN subject_baths - 0.5 AND subject_baths + 0.5)
      AND (subject_area  IS NULL OR cl.area  BETWEEN subject_area * (1 - area_tolerance) AND subject_area * (1 + area_tolerance))
  ),
  scored AS (
    SELECT
      *,
      1.0 / (1.0 + distance_m / 1000.0) AS dist_score,
      CASE
        WHEN subject_price IS NOT NULL AND price > 0
        THEN 1.0 / (1.0 + ABS(LN(GREATEST(subject_price, 1)::float / GREATEST(price, 1)::float)))
      END AS price_score,
      CASE
        WHEN subject_baths IS NOT NULL AND baths IS NOT NULL
        THEN CASE
               WHEN ABS(subject_baths::float - baths::float) < 0.5 THEN 1.0
               WHEN ABS(subject_baths::float - baths::float) < 1.5 THEN 0.5
               ELSE 0.25
             END
      END AS baths_score,
      CASE
        WHEN subject_area IS NOT NULL AND area IS NOT NULL AND subject_area > 0
        THEN 1.0 / (1.0 + ABS(subject_area::float - area::float) / subject_area::float)
      END AS area_score
    FROM candidates
    WHERE distance_m > 10
  ),
  weighted AS (
    SELECT
      *,
      0.05                                                            AS w_dist,
      CASE WHEN price_score IS NOT NULL THEN 0.60 ELSE 0 END           AS w_price,
      CASE WHEN baths_score IS NOT NULL THEN 0.20 ELSE 0 END           AS w_baths,
      CASE WHEN area_score  IS NOT NULL THEN 0.15 ELSE 0 END           AS w_area
    FROM scored
  ),
  final_scored AS (
    SELECT
      *,
      CASE
        WHEN (w_price + w_baths + w_area) = 0
        THEN dist_score
        ELSE (
          w_dist  * dist_score  +
          w_price * COALESCE(price_score, 0) +
          w_baths * COALESCE(baths_score, 0) +
          w_area  * COALESCE(area_score,  0)
        ) / (w_dist + w_price + w_baths + w_area)
      END AS composite_score
    FROM weighted
  ),
  non_reit AS (
    SELECT
      id, address_raw, address_street, address_city, address_state, address_zip,
      price, beds, baths, area, distance_m, composite_score, building_zpid,
      1::integer AS unit_count
    FROM final_scored
    WHERE building_zpid IS NULL
  ),
  reit_agg AS (
    SELECT
      (array_agg(id ORDER BY price))[1]             AS id,
      (array_agg(address_raw ORDER BY price))[1]    AS address_raw,
      (array_agg(address_street ORDER BY price))[1] AS address_street,
      (array_agg(address_city ORDER BY price))[1]   AS address_city,
      (array_agg(address_state ORDER BY price))[1]  AS address_state,
      (array_agg(address_zip ORDER BY price))[1]    AS address_zip,
      ROUND(AVG(price))::integer                    AS price,
      beds,
      baths,
      ROUND(AVG(area))::integer                     AS area,
      MIN(distance_m)                               AS distance_m,
      AVG(composite_score)                          AS composite_score,
      building_zpid,
      COUNT(*)::integer                             AS unit_count
    FROM final_scored
    WHERE building_zpid IS NOT NULL
    GROUP BY building_zpid, beds, baths
  )
  SELECT * FROM non_reit
  UNION ALL
  SELECT * FROM reit_agg
  ORDER BY composite_score DESC
  LIMIT p_limit;
$function$
