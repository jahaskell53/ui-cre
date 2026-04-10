--
-- PostgreSQL database dump
--

\restrict abbvUSExRwmAxi9RbJxKoJypArnchyTyijZXbotFaHq291Kpuyg6VAeyUfhWSf2

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.9 (Ubuntu 17.9-1.pgdg24.04+1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: create_message_notification(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_message_notification() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
begin
  insert into public.notifications (user_id, type, content, related_id)
  values (
    new.recipient_id,
    'message',
    new.content,
    new.id
  );
  return new;
end;
$$;


--
-- Name: ensure_system_account_profile(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.ensure_system_account_profile() RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
declare
    system_user_id uuid;
    system_profile_id uuid;
begin
    -- Try to find existing system account user
    select id into system_user_id
    from auth.users
    where email = 'system@openmidmarket.com' or raw_user_meta_data->>'full_name' = 'OpenMidmarket' -- pragma: allowlist secret
    limit 1;

    -- If user exists, ensure profile exists
    if system_user_id is not null then
        insert into profiles (id, full_name, is_admin)
        values (system_user_id, 'OpenMidmarket', false) -- pragma: allowlist secret
        on conflict (id) do update
        set full_name = 'OpenMidmarket'; -- pragma: allowlist secret
        
        return system_user_id;
    end if;

    -- If no user found, return null (user needs to be created manually)
    return null;
end;
$$;


--
-- Name: find_neighborhood(double precision, double precision); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.find_neighborhood(p_lng double precision, p_lat double precision) RETURNS TABLE(id integer, name character varying, city character varying, state character varying, geojson text)
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
  SELECT id, name, city, state, ST_AsGeoJSON(geom)::text AS geojson
  FROM neighborhoods
  WHERE ST_Within(ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326), geom)
  LIMIT 1;
$$;


--
-- Name: get_adjacent_neighborhoods(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_adjacent_neighborhoods(p_id integer) RETURNS TABLE(id integer, name character varying, city character varying, geojson text)
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
  SELECT n.id, n.name, n.city, ST_AsGeoJSON(n.geom)::text
  FROM neighborhoods n, neighborhoods subject
  WHERE subject.id = p_id
    AND ST_DWithin(n.geom::geography, subject.geom::geography, 100);
$$;


--
-- Name: get_adjacent_neighborhoods_batch(integer[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_adjacent_neighborhoods_batch(p_ids integer[]) RETURNS TABLE(id integer, name character varying, city character varying, geojson text)
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
  SELECT DISTINCT ON (n.id) n.id, n.name, n.city, ST_AsGeoJSON(n.geom)::text AS geojson
  FROM neighborhoods n
  WHERE EXISTS (
    SELECT 1 FROM neighborhoods s
    WHERE s.id = ANY(p_ids)
      AND ST_DWithin(n.geom, s.geom, 0.001)
  )
  AND n.id != ALL(p_ids)
  ORDER BY n.id;
$$;


--
-- Name: get_city_geojson(text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_city_geojson(p_name text, p_state text) RETURNS text
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
  SELECT ST_AsGeoJSON(ST_SimplifyPreserveTopology(geom, 0.0001))::text
  FROM city_boundaries
  WHERE name ILIKE p_name
    AND state ILIKE p_state
  LIMIT 1;
$$;


--
-- Name: get_comps(double precision, double precision, double precision, integer, integer, numeric, integer, integer, text, integer, text, boolean, integer[], text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_comps(subject_lng double precision, subject_lat double precision, radius_m double precision DEFAULT 3218, subject_price integer DEFAULT NULL::integer, subject_beds integer DEFAULT NULL::integer, subject_baths numeric DEFAULT NULL::numeric, subject_area integer DEFAULT NULL::integer, p_limit integer DEFAULT 10, p_segment text DEFAULT 'both'::text, p_neighborhood_id integer DEFAULT NULL::integer, p_subject_zip text DEFAULT NULL::text, p_expand_adjacent boolean DEFAULT false, p_neighborhood_ids integer[] DEFAULT NULL::integer[], p_home_type text DEFAULT NULL::text) RETURNS TABLE(id uuid, address_raw text, address_street text, address_city text, address_state text, address_zip text, price integer, beds integer, baths numeric, area integer, distance_m double precision, composite_score double precision, building_zpid text, unit_count integer)
    LANGUAGE sql
    AS $$
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
  prefiltered AS (
    SELECT cl.*
    FROM cleaned_listings cl
    WHERE cl.geom IS NOT NULL
      AND cl.price IS NOT NULL
      AND cl.is_building IS NOT TRUE
      AND cl.home_type IS DISTINCT FROM 'SINGLE_FAMILY'
      AND (p_home_type IS NULL OR cl.home_type = p_home_type)
      AND (
        p_segment = 'both'
        OR (p_segment = 'mid' AND cl.building_zpid IS NULL)
        OR (p_segment = 'reit' AND cl.building_zpid IS NOT NULL)
      )
      AND (
        (
          p_neighborhood_ids IS NOT NULL
          AND ST_Within(cl.geom, (SELECT ST_Union(geom) FROM neighborhoods WHERE id = ANY(p_neighborhood_ids)))
        )
        OR (
          p_neighborhood_ids IS NULL
          AND p_neighborhood_id IS NOT NULL
          AND ST_Within(cl.geom, (SELECT geom FROM neighborhood_geom))
        )
        OR (
          p_neighborhood_ids IS NULL
          AND p_neighborhood_id IS NULL
          AND p_subject_zip IS NOT NULL
          AND cl.address_zip = p_subject_zip
        )
        OR (
          p_neighborhood_ids IS NULL
          AND p_neighborhood_id IS NULL
          AND p_subject_zip IS NULL
          AND ST_DWithin(
            ST_SetSRID(ST_Point(subject_lng, subject_lat), 4326)::geography,
            cl.geom::geography,
            radius_m
          )
        )
      )
  ),
  deduped AS (
    SELECT DISTINCT ON (zpid)
      id, address_raw, address_street, address_city, address_state, address_zip,
      price, beds, baths, area, building_zpid, geom, home_type, is_building
    FROM prefiltered
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
    WHERE (subject_beds IS NULL OR COALESCE(cl.beds, 0) = subject_beds)
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
$$;


--
-- Name: get_county_geojson(text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_county_geojson(p_name text, p_state text) RETURNS text
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
  SELECT ST_AsGeoJSON(ST_SimplifyPreserveTopology(geom, 0.0001))::text
  FROM county_boundaries
  WHERE name_lsad ILIKE p_name
    AND state = p_state
  LIMIT 1;
$$;


--
-- Name: get_expanded_neighborhood_geojson(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_expanded_neighborhood_geojson(p_id integer) RETURNS TABLE(geojson text, neighbor_count integer)
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
  WITH subject AS (
    SELECT geom FROM neighborhoods WHERE id = p_id
  ),
  all_included AS (
    SELECT n.id, n.geom
    FROM neighborhoods n, subject
    WHERE ST_DWithin(n.geom::geography, subject.geom::geography, 100)
  )
  SELECT
    ST_AsGeoJSON(ST_Union(geom))::text AS geojson,
    (COUNT(*) - 1)::integer            AS neighbor_count
  FROM all_included;
$$;


--
-- Name: get_map_rent_trends(integer, integer, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_map_rent_trends(p_beds integer, p_weeks_back integer DEFAULT 13, p_reits_only boolean DEFAULT false) RETURNS TABLE(zip text, geom_json text, current_median numeric, prior_median numeric, pct_change numeric, listing_count bigint)
    LANGUAGE sql SECURITY DEFINER
    AS $$
    WITH weekly AS (
        SELECT
            address_zip                                                    AS z,
            DATE_TRUNC('week', scraped_at)::date                           AS week_start,
            PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY price)             AS median_rent,
            COUNT(DISTINCT zpid)                                           AS n
        FROM cleaned_listings
        WHERE price > 500
          AND price < 30000
          AND address_zip IS NOT NULL
          AND scraped_at >= NOW() - (p_weeks_back || ' weeks')::interval
          AND CASE WHEN COALESCE(beds, 0) >= 3 THEN 3 ELSE COALESCE(beds, 0) END = p_beds
          AND home_type IS DISTINCT FROM 'SINGLE_FAMILY'
          AND (
              (p_reits_only     AND building_zpid IS NOT NULL)
           OR (NOT p_reits_only AND building_zpid IS NULL)
          )
        GROUP BY address_zip, week_start
    ),
    ranked AS (
        SELECT
            z,
            median_rent,
            n,
            ROW_NUMBER() OVER (PARTITION BY z ORDER BY week_start DESC) AS rn_desc,
            ROW_NUMBER() OVER (PARTITION BY z ORDER BY week_start ASC)  AS rn_asc,
            COUNT(*)     OVER (PARTITION BY z)                          AS week_count,
            SUM(n)       OVER (PARTITION BY z)                          AS total_n
        FROM weekly
    ),
    current_vals AS (
        SELECT z, median_rent, total_n FROM ranked WHERE rn_desc = 1 AND week_count >= 2
    ),
    prior_vals AS (
        SELECT z, median_rent FROM ranked WHERE rn_asc = 1 AND week_count >= 2
    )
    SELECT
        c.z                                                                     AS zip,
        ST_AsGeoJSON(ST_SimplifyPreserveTopology(zk.geom, 0.001))              AS geom_json,
        c.median_rent                                                           AS current_median,
        p.median_rent                                                           AS prior_median,
        CASE WHEN p.median_rent > 0
            THEN ROUND(((c.median_rent - p.median_rent) / p.median_rent * 100)::numeric, 1)
            ELSE NULL
        END                                                                     AS pct_change,
        c.total_n                                                               AS listing_count
    FROM current_vals  c
    JOIN prior_vals    p  ON c.z  = p.z
    JOIN zip_codes     zk ON c.z  = zk.zip
    WHERE zk.geom IS NOT NULL;
$$;


--
-- Name: get_map_rent_trends_by_city(integer, integer, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_map_rent_trends_by_city(p_beds integer, p_weeks_back integer DEFAULT 13, p_reits_only boolean DEFAULT false) RETURNS TABLE(city_name text, state text, geom_json text, current_median numeric, prior_median numeric, pct_change numeric, listing_count bigint)
    LANGUAGE sql SECURITY DEFINER
    AS $$
    WITH weekly AS (
        SELECT
            cb.name                                                            AS city_name,
            cb.state                                                           AS state,
            DATE_TRUNC('week', cl.scraped_at)::date                           AS week_start,
            PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY cl.price)             AS median_rent,
            COUNT(DISTINCT cl.zpid)                                            AS cnt
        FROM city_boundaries cb
        JOIN cleaned_listings cl
            ON lower(cl.address_city)  = lower(cb.name)
            AND lower(cl.address_state) = lower(cb.state)
        WHERE cl.price > 500
          AND cl.price < 30000
          AND cl.scraped_at >= NOW() - (p_weeks_back || ' weeks')::interval
          AND CASE WHEN COALESCE(cl.beds, 0) >= 3 THEN 3 ELSE COALESCE(cl.beds, 0) END = p_beds
          AND (
              (p_reits_only     AND cl.building_zpid IS NOT NULL)
           OR (NOT p_reits_only AND cl.building_zpid IS NULL)
          )
        GROUP BY cb.name, cb.state, week_start
    ),
    ranked AS (
        SELECT
            city_name,
            state,
            median_rent,
            cnt,
            ROW_NUMBER() OVER (PARTITION BY city_name, state ORDER BY week_start DESC) AS rn_desc,
            ROW_NUMBER() OVER (PARTITION BY city_name, state ORDER BY week_start ASC)  AS rn_asc,
            COUNT(*)     OVER (PARTITION BY city_name, state)                          AS week_count,
            SUM(cnt)     OVER (PARTITION BY city_name, state)                          AS total_n
        FROM weekly
    ),
    current_vals AS (
        SELECT city_name, state, median_rent, total_n FROM ranked WHERE rn_desc = 1 AND week_count >= 2
    ),
    prior_vals AS (
        SELECT city_name, state, median_rent FROM ranked WHERE rn_asc = 1 AND week_count >= 2
    )
    SELECT
        c.city_name,
        c.state,
        ST_AsGeoJSON(ST_SimplifyPreserveTopology(cb.geom, 0.0001))             AS geom_json,
        c.median_rent                                                            AS current_median,
        p.median_rent                                                            AS prior_median,
        CASE WHEN p.median_rent > 0
            THEN ROUND(((c.median_rent - p.median_rent) / p.median_rent * 100)::numeric, 1)
            ELSE NULL
        END                                                                      AS pct_change,
        c.total_n                                                                AS listing_count
    FROM current_vals  c
    JOIN prior_vals    p  ON c.city_name = p.city_name AND c.state = p.state
    JOIN city_boundaries cb ON cb.name = c.city_name AND cb.state = c.state
    WHERE cb.geom IS NOT NULL;
$$;


--
-- Name: get_map_rent_trends_by_county(integer, integer, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_map_rent_trends_by_county(p_beds integer, p_weeks_back integer DEFAULT 13, p_reits_only boolean DEFAULT false) RETURNS TABLE(county_name text, state text, geom_json text, current_median numeric, prior_median numeric, pct_change numeric, listing_count bigint)
    LANGUAGE sql SECURITY DEFINER
    AS $$
    WITH weekly AS (
        SELECT
            cb.name                                                            AS county_name,
            cb.state                                                           AS state,
            DATE_TRUNC('week', cl.scraped_at)::date                           AS week_start,
            PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY cl.price)             AS median_rent,
            COUNT(DISTINCT cl.zpid)                                           AS cnt
        FROM cleaned_listings cl
        JOIN county_boundaries cb ON ST_Within(cl.geom, cb.geom)
        WHERE cl.price > 500
          AND cl.price < 30000
          AND cl.geom IS NOT NULL
          AND cl.scraped_at >= NOW() - (p_weeks_back || ' weeks')::interval
          AND CASE WHEN COALESCE(cl.beds, 0) >= 3 THEN 3 ELSE COALESCE(cl.beds, 0) END = p_beds
          AND cl.home_type IS DISTINCT FROM 'SINGLE_FAMILY'
          AND (
              (p_reits_only     AND cl.building_zpid IS NOT NULL)
           OR (NOT p_reits_only AND cl.building_zpid IS NULL)
          )
        GROUP BY cb.name, cb.state, week_start
    ),
    ranked AS (
        SELECT
            county_name,
            state,
            median_rent,
            cnt,
            ROW_NUMBER() OVER (PARTITION BY county_name, state ORDER BY week_start DESC) AS rn_desc,
            ROW_NUMBER() OVER (PARTITION BY county_name, state ORDER BY week_start ASC)  AS rn_asc,
            COUNT(*)     OVER (PARTITION BY county_name, state)                          AS week_count,
            SUM(cnt)     OVER (PARTITION BY county_name, state)                          AS total_n
        FROM weekly
    ),
    current_vals AS (
        SELECT county_name, state, median_rent, total_n FROM ranked WHERE rn_desc = 1 AND week_count >= 2
    ),
    prior_vals AS (
        SELECT county_name, state, median_rent FROM ranked WHERE rn_asc = 1 AND week_count >= 2
    )
    SELECT
        c.county_name,
        c.state,
        ST_AsGeoJSON(ST_SimplifyPreserveTopology(cb.geom, 0.001))              AS geom_json,
        c.median_rent                                                           AS current_median,
        p.median_rent                                                           AS prior_median,
        CASE WHEN p.median_rent > 0
            THEN ROUND(((c.median_rent - p.median_rent) / p.median_rent * 100)::numeric, 1)
            ELSE NULL
        END                                                                     AS pct_change,
        c.total_n                                                               AS listing_count
    FROM current_vals  c
    JOIN prior_vals    p  ON c.county_name = p.county_name AND c.state = p.state
    JOIN county_boundaries cb ON cb.name = c.county_name AND cb.state = c.state
    WHERE cb.geom IS NOT NULL;
$$;


--
-- Name: get_map_rent_trends_by_msa(integer, integer, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_map_rent_trends_by_msa(p_beds integer, p_weeks_back integer DEFAULT 13, p_reits_only boolean DEFAULT false) RETURNS TABLE(geoid text, name text, geom_json text, current_median numeric, prior_median numeric, pct_change numeric, listing_count bigint)
    LANGUAGE sql SECURITY DEFINER
    AS $$
    WITH weekly AS (
        SELECT
            mb.geoid                                                           AS geoid,
            DATE_TRUNC('week', cl.scraped_at)::date                           AS week_start,
            PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY cl.price)             AS median_rent,
            COUNT(DISTINCT cl.zpid)                                           AS cnt
        FROM cleaned_listings cl
        JOIN msa_boundaries mb ON ST_Within(cl.geom, mb.geom)
        WHERE cl.price > 500
          AND cl.price < 30000
          AND cl.geom IS NOT NULL
          AND cl.scraped_at >= NOW() - (p_weeks_back || ' weeks')::interval
          AND CASE WHEN COALESCE(cl.beds, 0) >= 3 THEN 3 ELSE COALESCE(cl.beds, 0) END = p_beds
          AND cl.home_type IS DISTINCT FROM 'SINGLE_FAMILY'
          AND (
              (p_reits_only     AND cl.building_zpid IS NOT NULL)
           OR (NOT p_reits_only AND cl.building_zpid IS NULL)
          )
        GROUP BY mb.geoid, week_start
    ),
    ranked AS (
        SELECT
            geoid,
            median_rent,
            cnt,
            ROW_NUMBER() OVER (PARTITION BY geoid ORDER BY week_start DESC) AS rn_desc,
            ROW_NUMBER() OVER (PARTITION BY geoid ORDER BY week_start ASC)  AS rn_asc,
            COUNT(*)     OVER (PARTITION BY geoid)                          AS week_count,
            SUM(cnt)     OVER (PARTITION BY geoid)                          AS total_n
        FROM weekly
    ),
    current_vals AS (
        SELECT geoid, median_rent, total_n FROM ranked WHERE rn_desc = 1 AND week_count >= 2
    ),
    prior_vals AS (
        SELECT geoid, median_rent FROM ranked WHERE rn_asc = 1 AND week_count >= 2
    )
    SELECT
        mb.geoid,
        mb.name::text,
        ST_AsGeoJSON(ST_SimplifyPreserveTopology(mb.geom, 0.005))              AS geom_json,
        c.median_rent                                                           AS current_median,
        p.median_rent                                                           AS prior_median,
        CASE WHEN p.median_rent > 0
            THEN ROUND(((c.median_rent - p.median_rent) / p.median_rent * 100)::numeric, 1)
            ELSE NULL
        END                                                                     AS pct_change,
        c.total_n                                                               AS listing_count
    FROM current_vals  c
    JOIN prior_vals    p  ON c.geoid = p.geoid
    JOIN msa_boundaries mb ON c.geoid = mb.geoid
    WHERE mb.geom IS NOT NULL;
$$;


--
-- Name: get_map_rent_trends_by_neighborhood(integer, integer, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_map_rent_trends_by_neighborhood(p_beds integer, p_weeks_back integer DEFAULT 13, p_reits_only boolean DEFAULT false) RETURNS TABLE(neighborhood_id integer, name text, city text, geom_json text, current_median numeric, prior_median numeric, pct_change numeric, listing_count bigint)
    LANGUAGE sql SECURITY DEFINER
    AS $$
    WITH weekly AS (
        SELECT
            n.id                                                               AS nh_id,
            DATE_TRUNC('week', cl.scraped_at)::date                           AS week_start,
            PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY cl.price)             AS median_rent,
            COUNT(DISTINCT cl.zpid)                                           AS cnt
        FROM cleaned_listings cl
        JOIN neighborhoods n ON ST_Within(cl.geom, n.geom)
        WHERE cl.price > 500
          AND cl.price < 30000
          AND cl.geom IS NOT NULL
          AND cl.scraped_at >= NOW() - (p_weeks_back || ' weeks')::interval
          AND CASE WHEN COALESCE(cl.beds, 0) >= 3 THEN 3 ELSE COALESCE(cl.beds, 0) END = p_beds
          AND cl.home_type IS DISTINCT FROM 'SINGLE_FAMILY'
          AND (
              (p_reits_only     AND cl.building_zpid IS NOT NULL)
           OR (NOT p_reits_only AND cl.building_zpid IS NULL)
          )
        GROUP BY n.id, week_start
    ),
    ranked AS (
        SELECT
            nh_id,
            median_rent,
            cnt,
            ROW_NUMBER() OVER (PARTITION BY nh_id ORDER BY week_start DESC) AS rn_desc,
            ROW_NUMBER() OVER (PARTITION BY nh_id ORDER BY week_start ASC)  AS rn_asc,
            COUNT(*)     OVER (PARTITION BY nh_id)                          AS week_count,
            SUM(cnt)     OVER (PARTITION BY nh_id)                          AS total_n
        FROM weekly
    ),
    current_vals AS (
        SELECT nh_id, median_rent, total_n FROM ranked WHERE rn_desc = 1 AND week_count >= 2
    ),
    prior_vals AS (
        SELECT nh_id, median_rent FROM ranked WHERE rn_asc = 1 AND week_count >= 2
    )
    SELECT
        n.id                                                                    AS neighborhood_id,
        n.name::text,
        n.city::text,
        ST_AsGeoJSON(ST_SimplifyPreserveTopology(n.geom, 0.0005))              AS geom_json,
        c.median_rent                                                           AS current_median,
        p.median_rent                                                           AS prior_median,
        CASE WHEN p.median_rent > 0
            THEN ROUND(((c.median_rent - p.median_rent) / p.median_rent * 100)::numeric, 1)
            ELSE NULL
        END                                                                     AS pct_change,
        c.total_n                                                               AS listing_count
    FROM current_vals  c
    JOIN prior_vals    p  ON c.nh_id = p.nh_id
    JOIN neighborhoods n  ON c.nh_id = n.id
    WHERE n.geom IS NOT NULL;
$$;


--
-- Name: get_market_activity(text, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_market_activity(p_zip text DEFAULT NULL::text, p_reits_only boolean DEFAULT false) RETURNS TABLE(week_start date, beds integer, new_listings bigint, accumulated_listings bigint, closed_listings bigint)
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
WITH weekly AS (
  SELECT DISTINCT
    DATE_TRUNC('week', scraped_at)::date AS week_start,
    zpid,
    CASE WHEN COALESCE(beds, 0) >= 3 THEN 3 ELSE COALESCE(beds, 0) END AS beds
  FROM cleaned_listings
  WHERE
    zpid IS NOT NULL
    AND price > 500 AND price < 30000
    AND (p_zip IS NULL OR address_zip = p_zip)
    AND ((NOT p_reits_only AND building_zpid IS NULL) OR (p_reits_only AND building_zpid IS NOT NULL))
),
all_weeks AS (
  SELECT DISTINCT week_start FROM weekly
),
bed_types AS (SELECT DISTINCT beds FROM weekly),
week_pairs AS (
  SELECT
    week_start AS prev_week,
    LEAD(week_start) OVER (ORDER BY week_start) AS next_week
  FROM all_weeks
),
new_counts AS (
  SELECT cur.week_start, cur.beds, COUNT(*) AS cnt
  FROM weekly cur
  JOIN week_pairs wp ON wp.next_week = cur.week_start
  LEFT JOIN weekly prev
    ON prev.zpid = cur.zpid AND prev.beds = cur.beds
    AND prev.week_start = wp.prev_week
  WHERE prev.zpid IS NULL
  GROUP BY cur.week_start, cur.beds
),
closed_counts AS (
  SELECT wp.next_week AS week_start, prev.beds, COUNT(*) AS cnt
  FROM weekly prev
  JOIN week_pairs wp ON wp.prev_week = prev.week_start
  LEFT JOIN weekly nxt
    ON nxt.zpid = prev.zpid AND nxt.beds = prev.beds
    AND nxt.week_start = wp.next_week
  WHERE nxt.zpid IS NULL
    AND wp.next_week IS NOT NULL
  GROUP BY 1, prev.beds
)
SELECT
  w.week_start,
  b.beds,
  COALESCE(n.cnt, 0) AS new_listings,
  COUNT(DISTINCT wl.zpid) AS accumulated_listings,
  COALESCE(c.cnt, 0) AS closed_listings
FROM all_weeks w
CROSS JOIN bed_types b
LEFT JOIN weekly wl ON wl.week_start = w.week_start AND wl.beds = b.beds
LEFT JOIN new_counts n ON n.week_start = w.week_start AND n.beds = b.beds
LEFT JOIN closed_counts c ON c.week_start = w.week_start AND c.beds = b.beds
GROUP BY w.week_start, b.beds, n.cnt, c.cnt
ORDER BY w.week_start, b.beds;
$$;


--
-- Name: get_market_activity(text, boolean, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_market_activity(p_zip text DEFAULT NULL::text, p_reits_only boolean DEFAULT false, p_home_type text DEFAULT NULL::text) RETURNS TABLE(week_start date, beds integer, new_listings bigint, accumulated_listings bigint, closed_listings bigint)
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
WITH weekly AS (
  SELECT DISTINCT
    DATE_TRUNC('week', scraped_at)::date AS week_start,
    zpid,
    CASE WHEN COALESCE(beds, 0) >= 3 THEN 3 ELSE COALESCE(beds, 0) END AS beds
  FROM cleaned_listings
  WHERE
    zpid IS NOT NULL
    AND price > 500 AND price < 30000
    AND (p_zip IS NULL OR address_zip = p_zip)
    AND ((NOT p_reits_only AND building_zpid IS NULL) OR (p_reits_only AND building_zpid IS NOT NULL))
    AND home_type IS DISTINCT FROM 'SINGLE_FAMILY'
    AND (p_home_type IS NULL OR home_type = p_home_type)
),
bounds AS (
  SELECT MAX(week_start) AS max_week FROM weekly
),
all_weeks AS (
  SELECT DISTINCT week_start FROM weekly
),
bed_types AS (SELECT DISTINCT beds FROM weekly),
new_counts AS (
  SELECT cur.week_start, cur.beds, COUNT(*) AS cnt
  FROM weekly cur
  LEFT JOIN weekly prev
    ON prev.zpid = cur.zpid AND prev.beds = cur.beds
    AND prev.week_start = cur.week_start - INTERVAL '7 days'
  WHERE prev.zpid IS NULL
  GROUP BY cur.week_start, cur.beds
),
closed_counts AS (
  SELECT (prev.week_start + INTERVAL '7 days')::date AS week_start, prev.beds, COUNT(*) AS cnt
  FROM weekly prev
  LEFT JOIN weekly nxt
    ON nxt.zpid = prev.zpid AND nxt.beds = prev.beds
    AND nxt.week_start = prev.week_start + INTERVAL '7 days'
  CROSS JOIN bounds
  WHERE nxt.zpid IS NULL
    AND (prev.week_start + INTERVAL '7 days')::date <= bounds.max_week
  GROUP BY 1, prev.beds
)
SELECT
  w.week_start,
  b.beds,
  COALESCE(n.cnt, 0) AS new_listings,
  COUNT(DISTINCT wl.zpid) AS accumulated_listings,
  COALESCE(c.cnt, 0) AS closed_listings
FROM all_weeks w
CROSS JOIN bed_types b
LEFT JOIN weekly wl ON wl.week_start = w.week_start AND wl.beds = b.beds
LEFT JOIN new_counts n ON n.week_start = w.week_start AND n.beds = b.beds
LEFT JOIN closed_counts c ON c.week_start = w.week_start AND c.beds = b.beds
GROUP BY w.week_start, b.beds, n.cnt, c.cnt
ORDER BY w.week_start, b.beds;
$$;


--
-- Name: get_market_activity_by_city(text, text, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_market_activity_by_city(p_city text, p_state text, p_reits_only boolean DEFAULT false) RETURNS TABLE(week_start date, beds integer, new_listings bigint, accumulated_listings bigint, closed_listings bigint)
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
WITH weekly AS (
  SELECT DISTINCT
    DATE_TRUNC('week', scraped_at)::date AS week_start,
    zpid,
    CASE WHEN COALESCE(beds, 0) >= 3 THEN 3 ELSE COALESCE(beds, 0) END AS beds
  FROM cleaned_listings
  WHERE
    zpid IS NOT NULL
    AND price > 500 AND price < 30000
    AND address_city ILIKE p_city
    AND address_state ILIKE p_state
    AND ((NOT p_reits_only AND building_zpid IS NULL) OR (p_reits_only AND building_zpid IS NOT NULL))
),
all_weeks AS (
  SELECT DISTINCT week_start FROM weekly
),
bed_types AS (SELECT DISTINCT beds FROM weekly),
week_pairs AS (
  SELECT
    week_start AS prev_week,
    LEAD(week_start) OVER (ORDER BY week_start) AS next_week
  FROM all_weeks
),
new_counts AS (
  SELECT cur.week_start, cur.beds, COUNT(*) AS cnt
  FROM weekly cur
  JOIN week_pairs wp ON wp.next_week = cur.week_start
  LEFT JOIN weekly prev
    ON prev.zpid = cur.zpid AND prev.beds = cur.beds
    AND prev.week_start = wp.prev_week
  WHERE prev.zpid IS NULL
  GROUP BY cur.week_start, cur.beds
),
closed_counts AS (
  SELECT wp.next_week AS week_start, prev.beds, COUNT(*) AS cnt
  FROM weekly prev
  JOIN week_pairs wp ON wp.prev_week = prev.week_start
  LEFT JOIN weekly nxt
    ON nxt.zpid = prev.zpid AND nxt.beds = prev.beds
    AND nxt.week_start = wp.next_week
  WHERE nxt.zpid IS NULL
    AND wp.next_week IS NOT NULL
  GROUP BY 1, prev.beds
)
SELECT
  w.week_start,
  b.beds,
  COALESCE(n.cnt, 0) AS new_listings,
  COUNT(DISTINCT wl.zpid) AS accumulated_listings,
  COALESCE(c.cnt, 0) AS closed_listings
FROM all_weeks w
CROSS JOIN bed_types b
LEFT JOIN weekly wl ON wl.week_start = w.week_start AND wl.beds = b.beds
LEFT JOIN new_counts n ON n.week_start = w.week_start AND n.beds = b.beds
LEFT JOIN closed_counts c ON c.week_start = w.week_start AND c.beds = b.beds
GROUP BY w.week_start, b.beds, n.cnt, c.cnt
ORDER BY w.week_start, b.beds;
$$;


--
-- Name: get_market_activity_by_city(text, text, boolean, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_market_activity_by_city(p_city text, p_state text, p_reits_only boolean DEFAULT false, p_home_type text DEFAULT NULL::text) RETURNS TABLE(week_start date, beds integer, new_listings bigint, accumulated_listings bigint, closed_listings bigint)
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
WITH lifecycle AS (
  SELECT
    zpid,
    CASE WHEN COALESCE(beds, 0) >= 3 THEN 3 ELSE COALESCE(beds, 0) END AS beds,
    MIN(DATE_TRUNC('week', scraped_at)::date) AS first_seen,
    MAX(DATE_TRUNC('week', scraped_at)::date) AS last_seen
  FROM cleaned_listings
  WHERE zpid IS NOT NULL AND price > 500 AND price < 30000
    AND address_city ILIKE p_city AND address_state ILIKE p_state
    AND ((NOT p_reits_only AND building_zpid IS NULL) OR (p_reits_only AND building_zpid IS NOT NULL))
    AND home_type IS DISTINCT FROM 'SINGLE_FAMILY'
    AND (p_home_type IS NULL OR home_type = p_home_type)
  GROUP BY zpid, 2
),
bounds AS (SELECT MIN(first_seen) AS min_week, MAX(last_seen) AS max_week FROM lifecycle),
all_weeks AS (
  SELECT generate_series(min_week, max_week, interval '7 days')::date AS week_start
  FROM bounds WHERE min_week IS NOT NULL AND max_week IS NOT NULL
),
bed_types AS (SELECT DISTINCT beds FROM lifecycle)
SELECT
  w.week_start, b.beds,
  COUNT(*) FILTER (WHERE l.first_seen = w.week_start) AS new_listings,
  COUNT(*) FILTER (WHERE l.first_seen <= w.week_start AND l.last_seen >= w.week_start) AS accumulated_listings,
  COUNT(*) FILTER (WHERE l.last_seen = w.week_start AND l.last_seen > l.first_seen AND l.last_seen < (SELECT max_week FROM bounds)) AS closed_listings
FROM all_weeks w CROSS JOIN bed_types b JOIN lifecycle l ON l.beds = b.beds
GROUP BY w.week_start, b.beds ORDER BY w.week_start, b.beds;
$$;


--
-- Name: get_market_activity_by_county(text, text, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_market_activity_by_county(p_county_name text, p_state text, p_reits_only boolean DEFAULT false) RETURNS TABLE(week_start date, beds integer, new_listings bigint, accumulated_listings bigint, closed_listings bigint)
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
WITH weekly AS (
  SELECT DISTINCT
    DATE_TRUNC('week', cl.scraped_at)::date AS week_start,
    cl.zpid,
    CASE WHEN COALESCE(cl.beds, 0) >= 3 THEN 3 ELSE COALESCE(cl.beds, 0) END AS beds
  FROM cleaned_listings cl
  JOIN county_boundaries cb ON ST_Within(cl.geom, cb.geom)
  WHERE
    cl.geom IS NOT NULL
    AND cb.name_lsad ILIKE p_county_name
    AND cb.state = p_state
    AND cl.zpid IS NOT NULL
    AND cl.price > 500 AND cl.price < 30000
    AND ((NOT p_reits_only AND cl.building_zpid IS NULL) OR (p_reits_only AND cl.building_zpid IS NOT NULL))
),
all_weeks AS (
  SELECT DISTINCT week_start FROM weekly
),
bed_types AS (SELECT DISTINCT beds FROM weekly),
week_pairs AS (
  SELECT
    week_start AS prev_week,
    LEAD(week_start) OVER (ORDER BY week_start) AS next_week
  FROM all_weeks
),
new_counts AS (
  SELECT cur.week_start, cur.beds, COUNT(*) AS cnt
  FROM weekly cur
  JOIN week_pairs wp ON wp.next_week = cur.week_start
  LEFT JOIN weekly prev
    ON prev.zpid = cur.zpid AND prev.beds = cur.beds
    AND prev.week_start = wp.prev_week
  WHERE prev.zpid IS NULL
  GROUP BY cur.week_start, cur.beds
),
closed_counts AS (
  SELECT wp.next_week AS week_start, prev.beds, COUNT(*) AS cnt
  FROM weekly prev
  JOIN week_pairs wp ON wp.prev_week = prev.week_start
  LEFT JOIN weekly nxt
    ON nxt.zpid = prev.zpid AND nxt.beds = prev.beds
    AND nxt.week_start = wp.next_week
  WHERE nxt.zpid IS NULL
    AND wp.next_week IS NOT NULL
  GROUP BY 1, prev.beds
)
SELECT
  w.week_start,
  b.beds,
  COALESCE(n.cnt, 0) AS new_listings,
  COUNT(DISTINCT wl.zpid) AS accumulated_listings,
  COALESCE(c.cnt, 0) AS closed_listings
FROM all_weeks w
CROSS JOIN bed_types b
LEFT JOIN weekly wl ON wl.week_start = w.week_start AND wl.beds = b.beds
LEFT JOIN new_counts n ON n.week_start = w.week_start AND n.beds = b.beds
LEFT JOIN closed_counts c ON c.week_start = w.week_start AND c.beds = b.beds
GROUP BY w.week_start, b.beds, n.cnt, c.cnt
ORDER BY w.week_start, b.beds;
$$;


--
-- Name: get_market_activity_by_county(text, text, boolean, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_market_activity_by_county(p_county_name text, p_state text, p_reits_only boolean DEFAULT false, p_home_type text DEFAULT NULL::text) RETURNS TABLE(week_start date, beds integer, new_listings bigint, accumulated_listings bigint, closed_listings bigint)
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
WITH lifecycle AS (
  SELECT
    cl.zpid,
    CASE WHEN COALESCE(cl.beds, 0) >= 3 THEN 3 ELSE COALESCE(cl.beds, 0) END AS beds,
    MIN(DATE_TRUNC('week', cl.scraped_at)::date) AS first_seen,
    MAX(DATE_TRUNC('week', cl.scraped_at)::date) AS last_seen
  FROM cleaned_listings cl
  JOIN county_boundaries cb ON ST_Within(cl.geom, cb.geom)
  WHERE
    cl.geom IS NOT NULL AND cb.name_lsad ILIKE p_county_name AND cb.state = p_state
    AND cl.zpid IS NOT NULL AND cl.price > 500 AND cl.price < 30000
    AND ((NOT p_reits_only AND cl.building_zpid IS NULL) OR (p_reits_only AND cl.building_zpid IS NOT NULL))
    AND cl.home_type IS DISTINCT FROM 'SINGLE_FAMILY'
    AND (p_home_type IS NULL OR cl.home_type = p_home_type)
  GROUP BY cl.zpid, 2
),
bounds AS (SELECT MIN(first_seen) AS min_week, MAX(last_seen) AS max_week FROM lifecycle),
all_weeks AS (
  SELECT generate_series(min_week, max_week, interval '7 days')::date AS week_start
  FROM bounds WHERE min_week IS NOT NULL AND max_week IS NOT NULL
),
bed_types AS (SELECT DISTINCT beds FROM lifecycle)
SELECT
  w.week_start, b.beds,
  COUNT(*) FILTER (WHERE l.first_seen = w.week_start) AS new_listings,
  COUNT(*) FILTER (WHERE l.first_seen <= w.week_start AND l.last_seen >= w.week_start) AS accumulated_listings,
  COUNT(*) FILTER (WHERE l.last_seen = w.week_start AND l.last_seen > l.first_seen AND l.last_seen < (SELECT max_week FROM bounds)) AS closed_listings
FROM all_weeks w CROSS JOIN bed_types b JOIN lifecycle l ON l.beds = b.beds
GROUP BY w.week_start, b.beds ORDER BY w.week_start, b.beds;
$$;


--
-- Name: get_market_activity_by_msa(text, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_market_activity_by_msa(p_geoid text, p_reits_only boolean DEFAULT false) RETURNS TABLE(week_start date, beds integer, new_listings bigint, accumulated_listings bigint, closed_listings bigint)
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
WITH weekly AS (
  SELECT DISTINCT
    DATE_TRUNC('week', cl.scraped_at)::date AS week_start,
    cl.zpid,
    CASE WHEN COALESCE(cl.beds, 0) >= 3 THEN 3 ELSE COALESCE(cl.beds, 0) END AS beds
  FROM cleaned_listings cl
  JOIN msa_boundaries mb ON ST_Within(cl.geom, mb.geom)
  WHERE
    cl.geom IS NOT NULL
    AND mb.geoid = p_geoid
    AND cl.zpid IS NOT NULL
    AND cl.price > 500 AND cl.price < 30000
    AND ((NOT p_reits_only AND cl.building_zpid IS NULL) OR (p_reits_only AND cl.building_zpid IS NOT NULL))
),
all_weeks AS (
  SELECT DISTINCT week_start FROM weekly
),
bed_types AS (SELECT DISTINCT beds FROM weekly),
week_pairs AS (
  SELECT
    week_start AS prev_week,
    LEAD(week_start) OVER (ORDER BY week_start) AS next_week
  FROM all_weeks
),
new_counts AS (
  SELECT cur.week_start, cur.beds, COUNT(*) AS cnt
  FROM weekly cur
  JOIN week_pairs wp ON wp.next_week = cur.week_start
  LEFT JOIN weekly prev
    ON prev.zpid = cur.zpid AND prev.beds = cur.beds
    AND prev.week_start = wp.prev_week
  WHERE prev.zpid IS NULL
  GROUP BY cur.week_start, cur.beds
),
closed_counts AS (
  SELECT wp.next_week AS week_start, prev.beds, COUNT(*) AS cnt
  FROM weekly prev
  JOIN week_pairs wp ON wp.prev_week = prev.week_start
  LEFT JOIN weekly nxt
    ON nxt.zpid = prev.zpid AND nxt.beds = prev.beds
    AND nxt.week_start = wp.next_week
  WHERE nxt.zpid IS NULL
    AND wp.next_week IS NOT NULL
  GROUP BY 1, prev.beds
)
SELECT
  w.week_start,
  b.beds,
  COALESCE(n.cnt, 0) AS new_listings,
  COUNT(DISTINCT wl.zpid) AS accumulated_listings,
  COALESCE(c.cnt, 0) AS closed_listings
FROM all_weeks w
CROSS JOIN bed_types b
LEFT JOIN weekly wl ON wl.week_start = w.week_start AND wl.beds = b.beds
LEFT JOIN new_counts n ON n.week_start = w.week_start AND n.beds = b.beds
LEFT JOIN closed_counts c ON c.week_start = w.week_start AND c.beds = b.beds
GROUP BY w.week_start, b.beds, n.cnt, c.cnt
ORDER BY w.week_start, b.beds;
$$;


--
-- Name: get_market_activity_by_msa(text, boolean, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_market_activity_by_msa(p_geoid text, p_reits_only boolean DEFAULT false, p_home_type text DEFAULT NULL::text) RETURNS TABLE(week_start date, beds integer, new_listings bigint, accumulated_listings bigint, closed_listings bigint)
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
WITH lifecycle AS (
  SELECT
    cl.zpid,
    CASE WHEN COALESCE(cl.beds, 0) >= 3 THEN 3 ELSE COALESCE(cl.beds, 0) END AS beds,
    MIN(DATE_TRUNC('week', cl.scraped_at)::date) AS first_seen,
    MAX(DATE_TRUNC('week', cl.scraped_at)::date) AS last_seen
  FROM cleaned_listings cl
  JOIN msa_boundaries mb ON ST_Within(cl.geom, mb.geom)
  WHERE
    cl.geom IS NOT NULL AND mb.geoid = p_geoid
    AND cl.zpid IS NOT NULL AND cl.price > 500 AND cl.price < 30000
    AND ((NOT p_reits_only AND cl.building_zpid IS NULL) OR (p_reits_only AND cl.building_zpid IS NOT NULL))
    AND cl.home_type IS DISTINCT FROM 'SINGLE_FAMILY'
    AND (p_home_type IS NULL OR cl.home_type = p_home_type)
  GROUP BY cl.zpid, 2
),
bounds AS (SELECT MIN(first_seen) AS min_week, MAX(last_seen) AS max_week FROM lifecycle),
all_weeks AS (
  SELECT generate_series(min_week, max_week, interval '7 days')::date AS week_start
  FROM bounds WHERE min_week IS NOT NULL AND max_week IS NOT NULL
),
bed_types AS (SELECT DISTINCT beds FROM lifecycle)
SELECT
  w.week_start, b.beds,
  COUNT(*) FILTER (WHERE l.first_seen = w.week_start) AS new_listings,
  COUNT(*) FILTER (WHERE l.first_seen <= w.week_start AND l.last_seen >= w.week_start) AS accumulated_listings,
  COUNT(*) FILTER (WHERE l.last_seen = w.week_start AND l.last_seen > l.first_seen AND l.last_seen < (SELECT max_week FROM bounds)) AS closed_listings
FROM all_weeks w CROSS JOIN bed_types b JOIN lifecycle l ON l.beds = b.beds
GROUP BY w.week_start, b.beds ORDER BY w.week_start, b.beds;
$$;


--
-- Name: get_market_activity_by_neighborhood(integer[], boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_market_activity_by_neighborhood(p_neighborhood_ids integer[], p_reits_only boolean DEFAULT false) RETURNS TABLE(week_start date, beds integer, new_listings bigint, accumulated_listings bigint, closed_listings bigint)
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
WITH weekly AS (
  SELECT DISTINCT
    DATE_TRUNC('week', cl.scraped_at)::date AS week_start,
    cl.zpid,
    CASE WHEN COALESCE(cl.beds, 0) >= 3 THEN 3 ELSE COALESCE(cl.beds, 0) END AS beds
  FROM cleaned_listings cl
  JOIN neighborhoods n ON ST_Within(cl.geom, n.geom)
  WHERE
    cl.geom IS NOT NULL
    AND n.id = ANY(p_neighborhood_ids)
    AND cl.zpid IS NOT NULL
    AND cl.price > 500 AND cl.price < 30000
    AND ((NOT p_reits_only AND cl.building_zpid IS NULL) OR (p_reits_only AND cl.building_zpid IS NOT NULL))
),
all_weeks AS (
  SELECT DISTINCT week_start FROM weekly
),
bed_types AS (SELECT DISTINCT beds FROM weekly),
week_pairs AS (
  SELECT
    week_start AS prev_week,
    LEAD(week_start) OVER (ORDER BY week_start) AS next_week
  FROM all_weeks
),
new_counts AS (
  SELECT cur.week_start, cur.beds, COUNT(*) AS cnt
  FROM weekly cur
  JOIN week_pairs wp ON wp.next_week = cur.week_start
  LEFT JOIN weekly prev
    ON prev.zpid = cur.zpid AND prev.beds = cur.beds
    AND prev.week_start = wp.prev_week
  WHERE prev.zpid IS NULL
  GROUP BY cur.week_start, cur.beds
),
closed_counts AS (
  SELECT wp.next_week AS week_start, prev.beds, COUNT(*) AS cnt
  FROM weekly prev
  JOIN week_pairs wp ON wp.prev_week = prev.week_start
  LEFT JOIN weekly nxt
    ON nxt.zpid = prev.zpid AND nxt.beds = prev.beds
    AND nxt.week_start = wp.next_week
  WHERE nxt.zpid IS NULL
    AND wp.next_week IS NOT NULL
  GROUP BY 1, prev.beds
)
SELECT
  w.week_start,
  b.beds,
  COALESCE(n.cnt, 0) AS new_listings,
  COUNT(DISTINCT wl.zpid) AS accumulated_listings,
  COALESCE(c.cnt, 0) AS closed_listings
FROM all_weeks w
CROSS JOIN bed_types b
LEFT JOIN weekly wl ON wl.week_start = w.week_start AND wl.beds = b.beds
LEFT JOIN new_counts n ON n.week_start = w.week_start AND n.beds = b.beds
LEFT JOIN closed_counts c ON c.week_start = w.week_start AND c.beds = b.beds
GROUP BY w.week_start, b.beds, n.cnt, c.cnt
ORDER BY w.week_start, b.beds;
$$;


--
-- Name: get_market_activity_by_neighborhood(integer[], boolean, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_market_activity_by_neighborhood(p_neighborhood_ids integer[], p_reits_only boolean DEFAULT false, p_home_type text DEFAULT NULL::text) RETURNS TABLE(week_start date, beds integer, new_listings bigint, accumulated_listings bigint, closed_listings bigint)
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
WITH lifecycle AS (
  SELECT
    cl.zpid,
    CASE WHEN COALESCE(cl.beds, 0) >= 3 THEN 3 ELSE COALESCE(cl.beds, 0) END AS beds,
    MIN(DATE_TRUNC('week', cl.scraped_at)::date) AS first_seen,
    MAX(DATE_TRUNC('week', cl.scraped_at)::date) AS last_seen
  FROM cleaned_listings cl
  JOIN neighborhoods n ON ST_Within(cl.geom, n.geom)
  WHERE
    cl.geom IS NOT NULL
    AND n.id = ANY(p_neighborhood_ids)
    AND cl.zpid IS NOT NULL
    AND cl.price > 500 AND cl.price < 30000
    AND ((NOT p_reits_only AND cl.building_zpid IS NULL) OR (p_reits_only AND cl.building_zpid IS NOT NULL))
    AND cl.home_type IS DISTINCT FROM 'SINGLE_FAMILY'
    AND (p_home_type IS NULL OR cl.home_type = p_home_type)
  GROUP BY cl.zpid, 2
),
bounds AS (SELECT MIN(first_seen) AS min_week, MAX(last_seen) AS max_week FROM lifecycle),
all_weeks AS (
  SELECT generate_series(min_week, max_week, interval '7 days')::date AS week_start
  FROM bounds WHERE min_week IS NOT NULL AND max_week IS NOT NULL
),
bed_types AS (SELECT DISTINCT beds FROM lifecycle)
SELECT
  w.week_start, b.beds,
  COUNT(*) FILTER (WHERE l.first_seen = w.week_start) AS new_listings,
  COUNT(*) FILTER (WHERE l.first_seen <= w.week_start AND l.last_seen >= w.week_start) AS accumulated_listings,
  COUNT(*) FILTER (WHERE l.last_seen = w.week_start AND l.last_seen > l.first_seen AND l.last_seen < (SELECT max_week FROM bounds)) AS closed_listings
FROM all_weeks w CROSS JOIN bed_types b JOIN lifecycle l ON l.beds = b.beds
GROUP BY w.week_start, b.beds ORDER BY w.week_start, b.beds;
$$;


--
-- Name: get_msa_at_point(double precision, double precision); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_msa_at_point(p_lat double precision, p_lng double precision) RETURNS TABLE(id bigint, name text, name_lsad text, geoid text)
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
  SELECT id, name, name_lsad, geoid
  FROM msa_boundaries
  WHERE ST_Within(ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326), geom)
  LIMIT 1;
$$;


--
-- Name: get_msa_bbox(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_msa_bbox(p_geoid text) RETURNS TABLE(west double precision, south double precision, east double precision, north double precision)
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
  SELECT
    ST_XMin(ST_Envelope(geom))::float8 AS west,
    ST_YMin(ST_Envelope(geom))::float8 AS south,
    ST_XMax(ST_Envelope(geom))::float8 AS east,
    ST_YMax(ST_Envelope(geom))::float8 AS north
  FROM msa_boundaries
  WHERE geoid = p_geoid;
$$;


--
-- Name: get_msa_geojson(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_msa_geojson(p_geoid text) RETURNS text
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
  SELECT ST_AsGeoJSON(ST_SimplifyPreserveTopology(geom, 0.0001))::text
  FROM msa_boundaries
  WHERE geoid = p_geoid
  LIMIT 1;
$$;


--
-- Name: get_neighborhood_at_point(double precision, double precision); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_neighborhood_at_point(p_lat double precision, p_lng double precision) RETURNS TABLE(id integer, name character varying, city character varying, state character varying)
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
  SELECT id, name, city, state
  FROM neighborhoods
  WHERE ST_Within(ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326), geom)
  LIMIT 1;
$$;


--
-- Name: get_neighborhood_bbox(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_neighborhood_bbox(p_neighborhood_id integer) RETURNS TABLE(west double precision, south double precision, east double precision, north double precision)
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
  SELECT
    ST_XMin(ST_Envelope(geom))::float8 AS west,
    ST_YMin(ST_Envelope(geom))::float8 AS south,
    ST_XMax(ST_Envelope(geom))::float8 AS east,
    ST_YMax(ST_Envelope(geom))::float8 AS north
  FROM neighborhoods
  WHERE id = p_neighborhood_id;
$$;


--
-- Name: get_neighborhood_geojson(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_neighborhood_geojson(p_id integer) RETURNS text
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
  SELECT ST_AsGeoJSON(ST_SimplifyPreserveTopology(geom, 0.0001))::text
  FROM neighborhoods
  WHERE id = p_id
  LIMIT 1;
$$;


--
-- Name: get_rent_trends(text, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_rent_trends(p_zip text DEFAULT NULL::text, p_beds integer DEFAULT NULL::integer) RETURNS TABLE(week_start date, beds integer, median_rent numeric, listing_count bigint)
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
  SELECT
    DATE_TRUNC('week', scraped_at)::date AS week_start,
    CASE WHEN beds >= 3 THEN 3 ELSE beds END AS beds,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY price)::numeric AS median_rent,
    COUNT(*) AS listing_count
  FROM cleaned_listings
  WHERE
    price IS NOT NULL AND price > 500 AND price < 30000
    AND beds IS NOT NULL
    AND (p_zip IS NULL OR address_zip = p_zip)
    AND (p_beds IS NULL OR CASE WHEN beds >= 3 THEN 3 ELSE beds END = p_beds)
  GROUP BY 1, 2
  ORDER BY 1, 2;
$$;


--
-- Name: get_rent_trends(text, integer, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_rent_trends(p_zip text DEFAULT NULL::text, p_beds integer DEFAULT NULL::integer, p_reits_only boolean DEFAULT false) RETURNS TABLE(week_start date, beds integer, median_rent numeric, listing_count bigint)
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
  SELECT
    DATE_TRUNC('week', scraped_at)::date AS week_start,
    CASE WHEN beds IS NULL OR beds = 0 THEN 0 WHEN beds >= 3 THEN 3 ELSE beds END AS beds,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY price)::numeric AS median_rent,
    COUNT(*) AS listing_count
  FROM cleaned_listings
  WHERE
    price IS NOT NULL AND price > 500 AND price < 30000
    AND (p_zip IS NULL OR address_zip = p_zip)
    AND (p_beds IS NULL OR CASE WHEN beds IS NULL OR beds = 0 THEN 0 WHEN beds >= 3 THEN 3 ELSE beds END = p_beds)
    AND p_reits_only = (building_zpid IS NOT NULL)
  GROUP BY 1, 2
  ORDER BY 1, 2;
$$;


--
-- Name: get_rent_trends(text, integer, boolean, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_rent_trends(p_zip text DEFAULT NULL::text, p_beds integer DEFAULT NULL::integer, p_reits_only boolean DEFAULT false, p_home_type text DEFAULT NULL::text) RETURNS TABLE(week_start date, beds integer, median_rent numeric, listing_count bigint)
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
  SELECT
    DATE_TRUNC('week', scraped_at)::date AS week_start,
    CASE WHEN beds IS NULL OR beds = 0 THEN 0 WHEN beds >= 3 THEN 3 ELSE beds END AS beds,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY price)::numeric AS median_rent,
    COUNT(*) AS listing_count
  FROM cleaned_listings
  WHERE
    price IS NOT NULL AND price > 500 AND price < 30000
    AND (p_zip IS NULL OR address_zip = p_zip)
    AND (p_beds IS NULL OR CASE WHEN beds IS NULL OR beds = 0 THEN 0 WHEN beds >= 3 THEN 3 ELSE beds END = p_beds)
    AND p_reits_only = (building_zpid IS NOT NULL)
    AND home_type IS DISTINCT FROM 'SINGLE_FAMILY'
    AND (p_home_type IS NULL OR home_type = p_home_type)
  GROUP BY 1, 2
  ORDER BY 1, 2;
$$;


--
-- Name: get_rent_trends_by_city(text, text, integer, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_rent_trends_by_city(p_city text, p_state text, p_beds integer DEFAULT NULL::integer, p_reits_only boolean DEFAULT false) RETURNS TABLE(week_start date, beds integer, median_rent numeric, listing_count bigint)
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
  SELECT
    DATE_TRUNC('week', scraped_at)::date AS week_start,
    CASE WHEN COALESCE(beds, 0) >= 3 THEN 3 ELSE COALESCE(beds, 0) END AS beds,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY price)::numeric AS median_rent,
    COUNT(*) AS listing_count
  FROM cleaned_listings
  WHERE
    price IS NOT NULL AND price > 500 AND price < 30000
    AND address_city ILIKE p_city
    AND address_state ILIKE p_state
    AND (p_beds IS NULL OR CASE WHEN COALESCE(beds, 0) >= 3 THEN 3 ELSE COALESCE(beds, 0) END = p_beds)
    AND (
      (NOT p_reits_only AND building_zpid IS NULL)
      OR (p_reits_only AND building_zpid IS NOT NULL)
    )
  GROUP BY 1, 2
  ORDER BY 1, 2;
$$;


--
-- Name: get_rent_trends_by_city(text, text, integer, boolean, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_rent_trends_by_city(p_city text, p_state text, p_beds integer DEFAULT NULL::integer, p_reits_only boolean DEFAULT false, p_home_type text DEFAULT NULL::text) RETURNS TABLE(week_start date, beds integer, median_rent numeric, listing_count bigint)
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
  SELECT
    DATE_TRUNC('week', scraped_at)::date AS week_start,
    CASE WHEN COALESCE(beds, 0) >= 3 THEN 3 ELSE COALESCE(beds, 0) END AS beds,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY price)::numeric AS median_rent,
    COUNT(*) AS listing_count
  FROM cleaned_listings
  WHERE
    price IS NOT NULL AND price > 500 AND price < 30000
    AND address_city ILIKE p_city AND address_state ILIKE p_state
    AND (p_beds IS NULL OR CASE WHEN COALESCE(beds, 0) >= 3 THEN 3 ELSE COALESCE(beds, 0) END = p_beds)
    AND ((NOT p_reits_only AND building_zpid IS NULL) OR (p_reits_only AND building_zpid IS NOT NULL))
    AND home_type IS DISTINCT FROM 'SINGLE_FAMILY'
    AND (p_home_type IS NULL OR home_type = p_home_type)
  GROUP BY 1, 2 ORDER BY 1, 2;
$$;


--
-- Name: get_rent_trends_by_county(text, text, integer, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_rent_trends_by_county(p_county_name text, p_state text, p_beds integer DEFAULT NULL::integer, p_reits_only boolean DEFAULT false) RETURNS TABLE(week_start date, beds integer, median_rent numeric, listing_count bigint)
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
  SELECT
    DATE_TRUNC('week', cl.scraped_at)::date AS week_start,
    CASE WHEN COALESCE(cl.beds, 0) >= 3 THEN 3 ELSE COALESCE(cl.beds, 0) END AS beds,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY cl.price)::numeric AS median_rent,
    COUNT(*) AS listing_count
  FROM cleaned_listings cl
  JOIN county_boundaries cb ON ST_Within(cl.geom, cb.geom)
  WHERE
    cl.geom IS NOT NULL
    AND cb.name_lsad ILIKE p_county_name
    AND cb.state = p_state
    AND cl.price IS NOT NULL AND cl.price > 500 AND cl.price < 30000
    AND (p_beds IS NULL OR CASE WHEN COALESCE(cl.beds, 0) >= 3 THEN 3 ELSE COALESCE(cl.beds, 0) END = p_beds)
    AND (
      (NOT p_reits_only AND cl.building_zpid IS NULL)
      OR (p_reits_only AND cl.building_zpid IS NOT NULL)
    )
  GROUP BY 1, 2
  ORDER BY 1, 2;
$$;


--
-- Name: get_rent_trends_by_county(text, text, integer, boolean, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_rent_trends_by_county(p_county_name text, p_state text, p_beds integer DEFAULT NULL::integer, p_reits_only boolean DEFAULT false, p_home_type text DEFAULT NULL::text) RETURNS TABLE(week_start date, beds integer, median_rent numeric, listing_count bigint)
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
  SELECT
    DATE_TRUNC('week', cl.scraped_at)::date AS week_start,
    CASE WHEN COALESCE(cl.beds, 0) >= 3 THEN 3 ELSE COALESCE(cl.beds, 0) END AS beds,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY cl.price)::numeric AS median_rent,
    COUNT(*) AS listing_count
  FROM cleaned_listings cl
  JOIN county_boundaries cb ON ST_Within(cl.geom, cb.geom)
  WHERE
    cl.geom IS NOT NULL AND cb.name_lsad ILIKE p_county_name AND cb.state = p_state
    AND cl.price IS NOT NULL AND cl.price > 500 AND cl.price < 30000
    AND (p_beds IS NULL OR CASE WHEN COALESCE(cl.beds, 0) >= 3 THEN 3 ELSE COALESCE(cl.beds, 0) END = p_beds)
    AND ((NOT p_reits_only AND cl.building_zpid IS NULL) OR (p_reits_only AND cl.building_zpid IS NOT NULL))
    AND cl.home_type IS DISTINCT FROM 'SINGLE_FAMILY'
    AND (p_home_type IS NULL OR cl.home_type = p_home_type)
  GROUP BY 1, 2 ORDER BY 1, 2;
$$;


--
-- Name: get_rent_trends_by_msa(text, integer, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_rent_trends_by_msa(p_geoid text, p_beds integer DEFAULT NULL::integer, p_reits_only boolean DEFAULT false) RETURNS TABLE(week_start date, beds integer, median_rent numeric, listing_count bigint)
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
  SELECT
    DATE_TRUNC('week', cl.scraped_at)::date AS week_start,
    CASE WHEN COALESCE(cl.beds, 0) >= 3 THEN 3 ELSE COALESCE(cl.beds, 0) END AS beds,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY cl.price)::numeric AS median_rent,
    COUNT(*) AS listing_count
  FROM cleaned_listings cl
  JOIN msa_boundaries mb ON ST_Within(cl.geom, mb.geom)
  WHERE
    cl.geom IS NOT NULL
    AND mb.geoid = p_geoid
    AND cl.price IS NOT NULL AND cl.price > 500 AND cl.price < 30000
    AND (p_beds IS NULL OR CASE WHEN COALESCE(cl.beds, 0) >= 3 THEN 3 ELSE COALESCE(cl.beds, 0) END = p_beds)
    AND (
      (NOT p_reits_only AND cl.building_zpid IS NULL)
      OR (p_reits_only AND cl.building_zpid IS NOT NULL)
    )
  GROUP BY 1, 2
  ORDER BY 1, 2;
$$;


--
-- Name: get_rent_trends_by_msa(text, integer, boolean, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_rent_trends_by_msa(p_geoid text, p_beds integer DEFAULT NULL::integer, p_reits_only boolean DEFAULT false, p_home_type text DEFAULT NULL::text) RETURNS TABLE(week_start date, beds integer, median_rent numeric, listing_count bigint)
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
  SELECT
    DATE_TRUNC('week', cl.scraped_at)::date AS week_start,
    CASE WHEN COALESCE(cl.beds, 0) >= 3 THEN 3 ELSE COALESCE(cl.beds, 0) END AS beds,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY cl.price)::numeric AS median_rent,
    COUNT(*) AS listing_count
  FROM cleaned_listings cl
  JOIN msa_boundaries mb ON ST_Within(cl.geom, mb.geom)
  WHERE
    cl.geom IS NOT NULL AND mb.geoid = p_geoid
    AND cl.price IS NOT NULL AND cl.price > 500 AND cl.price < 30000
    AND (p_beds IS NULL OR CASE WHEN COALESCE(cl.beds, 0) >= 3 THEN 3 ELSE COALESCE(cl.beds, 0) END = p_beds)
    AND ((NOT p_reits_only AND cl.building_zpid IS NULL) OR (p_reits_only AND cl.building_zpid IS NOT NULL))
    AND cl.home_type IS DISTINCT FROM 'SINGLE_FAMILY'
    AND (p_home_type IS NULL OR cl.home_type = p_home_type)
  GROUP BY 1, 2 ORDER BY 1, 2;
$$;


--
-- Name: get_rent_trends_by_neighborhood(integer[], integer, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_rent_trends_by_neighborhood(p_neighborhood_ids integer[], p_beds integer DEFAULT NULL::integer, p_reits_only boolean DEFAULT false) RETURNS TABLE(week_start date, beds integer, median_rent numeric, listing_count bigint)
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
  SELECT
    DATE_TRUNC('week', cl.scraped_at)::date AS week_start,
    CASE WHEN COALESCE(cl.beds, 0) >= 3 THEN 3 ELSE COALESCE(cl.beds, 0) END AS beds,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY cl.price)::numeric AS median_rent,
    COUNT(*) AS listing_count
  FROM cleaned_listings cl
  JOIN neighborhoods n ON ST_Within(cl.geom, n.geom)
  WHERE
    cl.geom IS NOT NULL
    AND n.id = ANY(p_neighborhood_ids)
    AND cl.price IS NOT NULL AND cl.price > 500 AND cl.price < 30000
    AND (p_beds IS NULL OR CASE WHEN COALESCE(cl.beds, 0) >= 3 THEN 3 ELSE COALESCE(cl.beds, 0) END = p_beds)
    AND (
      (NOT p_reits_only AND cl.building_zpid IS NULL)
      OR (p_reits_only AND cl.building_zpid IS NOT NULL)
    )
  GROUP BY 1, 2
  ORDER BY 1, 2;
$$;


--
-- Name: get_rent_trends_by_neighborhood(integer[], integer, boolean, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_rent_trends_by_neighborhood(p_neighborhood_ids integer[], p_beds integer DEFAULT NULL::integer, p_reits_only boolean DEFAULT false, p_home_type text DEFAULT NULL::text) RETURNS TABLE(week_start date, beds integer, median_rent numeric, listing_count bigint)
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
  SELECT
    DATE_TRUNC('week', cl.scraped_at)::date AS week_start,
    CASE WHEN COALESCE(cl.beds, 0) >= 3 THEN 3 ELSE COALESCE(cl.beds, 0) END AS beds,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY cl.price)::numeric AS median_rent,
    COUNT(*) AS listing_count
  FROM cleaned_listings cl
  JOIN neighborhoods n ON ST_Within(cl.geom, n.geom)
  WHERE
    cl.geom IS NOT NULL
    AND n.id = ANY(p_neighborhood_ids)
    AND cl.price IS NOT NULL AND cl.price > 500 AND cl.price < 30000
    AND (p_beds IS NULL OR CASE WHEN COALESCE(cl.beds, 0) >= 3 THEN 3 ELSE COALESCE(cl.beds, 0) END = p_beds)
    AND ((NOT p_reits_only AND cl.building_zpid IS NULL) OR (p_reits_only AND cl.building_zpid IS NOT NULL))
    AND cl.home_type IS DISTINCT FROM 'SINGLE_FAMILY'
    AND (p_home_type IS NULL OR cl.home_type = p_home_type)
  GROUP BY 1, 2
  ORDER BY 1, 2;
$$;


--
-- Name: get_zillow_map_clusters(text, text, text, boolean, integer, integer, integer, integer, integer[], numeric, text[], text, double precision, double precision, double precision, double precision, double precision); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_zillow_map_clusters(p_zip text DEFAULT NULL::text, p_city text DEFAULT NULL::text, p_address_query text DEFAULT NULL::text, p_latest_only boolean DEFAULT false, p_price_min integer DEFAULT NULL::integer, p_price_max integer DEFAULT NULL::integer, p_sqft_min integer DEFAULT NULL::integer, p_sqft_max integer DEFAULT NULL::integer, p_beds integer[] DEFAULT NULL::integer[], p_baths_min numeric DEFAULT NULL::numeric, p_home_types text[] DEFAULT NULL::text[], p_property_type text DEFAULT 'both'::text, p_bounds_south double precision DEFAULT NULL::double precision, p_bounds_north double precision DEFAULT NULL::double precision, p_bounds_west double precision DEFAULT NULL::double precision, p_bounds_east double precision DEFAULT NULL::double precision, p_grid_step double precision DEFAULT 0.05) RETURNS TABLE(lat double precision, lng double precision, point_count integer, avg_price integer)
    LANGUAGE sql STABLE
    AS $$

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

$$;


--
-- Name: get_zillow_map_listings(text, text, text, boolean, integer, integer, integer, integer, integer[], numeric, text[], text, double precision, double precision, double precision, double precision); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_zillow_map_listings(p_zip text DEFAULT NULL::text, p_city text DEFAULT NULL::text, p_address_query text DEFAULT NULL::text, p_latest_only boolean DEFAULT false, p_price_min integer DEFAULT NULL::integer, p_price_max integer DEFAULT NULL::integer, p_sqft_min integer DEFAULT NULL::integer, p_sqft_max integer DEFAULT NULL::integer, p_beds integer[] DEFAULT NULL::integer[], p_baths_min numeric DEFAULT NULL::numeric, p_home_types text[] DEFAULT NULL::text[], p_property_type text DEFAULT 'both'::text, p_bounds_south double precision DEFAULT NULL::double precision, p_bounds_north double precision DEFAULT NULL::double precision, p_bounds_west double precision DEFAULT NULL::double precision, p_bounds_east double precision DEFAULT NULL::double precision) RETURNS TABLE(id text, address text, longitude double precision, latitude double precision, price_label text, is_reit boolean, unit_count integer, unit_mix jsonb, img_src text, area integer, scraped_at timestamp with time zone, total_count bigint)
    LANGUAGE sql STABLE
    AS $_$

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
        cl.zpid,
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

$_$;


--
-- Name: get_zip_boundary(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_zip_boundary(p_zip text) RETURNS text
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
  SELECT ST_AsGeoJSON(geom)::text FROM zip_codes WHERE zip = p_zip LIMIT 1;
$$;


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (new.id, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url');
  return new;
end;
$$;


--
-- Name: handle_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$;


--
-- Name: insert_cleaned_listing(text, timestamp with time zone, text, text, text, text, text, text, text, integer, integer, numeric, integer, date, double precision, double precision, boolean, uuid, text, text, boolean, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.insert_cleaned_listing(p_run_id text, p_scraped_at timestamp with time zone, p_zip_code text, p_zpid text, p_address_raw text, p_address_street text, p_address_city text, p_address_state text, p_address_zip text, p_price integer, p_beds integer, p_baths numeric, p_area integer, p_availability_date date, p_lat double precision, p_lng double precision, p_is_sfr boolean DEFAULT NULL::boolean, p_raw_scrape_id uuid DEFAULT NULL::uuid, p_img_src text DEFAULT NULL::text, p_detail_url text DEFAULT NULL::text, p_is_building boolean DEFAULT false, p_building_zpid text DEFAULT NULL::text) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
    INSERT INTO cleaned_listings (
        run_id, scraped_at, zip_code, zpid,
        address_raw, address_street, address_city, address_state, address_zip,
        price, beds, baths, area, availability_date,
        geom, is_sfr, raw_scrape_id,
        img_src, detail_url, is_building, building_zpid
    ) VALUES (
        p_run_id, p_scraped_at, p_zip_code, p_zpid,
        p_address_raw, p_address_street, p_address_city, p_address_state, p_address_zip,
        p_price, p_beds, p_baths, p_area, p_availability_date,
        CASE WHEN p_lat IS NOT NULL AND p_lng IS NOT NULL
             THEN ST_SetSRID(ST_Point(p_lng, p_lat), 4326)
             ELSE NULL
        END,
        p_is_sfr, p_raw_scrape_id,
        p_img_src, p_detail_url, p_is_building, p_building_zpid
    )
    ON CONFLICT (zpid, run_id) DO NOTHING;
END;
$$;


--
-- Name: insert_cleaned_listing(text, timestamp with time zone, text, text, text, text, text, text, text, integer, integer, numeric, integer, date, double precision, double precision, uuid, text, text, boolean, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.insert_cleaned_listing(p_run_id text, p_scraped_at timestamp with time zone, p_zip_code text, p_zpid text, p_address_raw text, p_address_street text, p_address_city text, p_address_state text, p_address_zip text, p_price integer, p_beds integer, p_baths numeric, p_area integer, p_availability_date date, p_lat double precision, p_lng double precision, p_raw_scrape_id uuid DEFAULT NULL::uuid, p_img_src text DEFAULT NULL::text, p_detail_url text DEFAULT NULL::text, p_is_building boolean DEFAULT false, p_building_zpid text DEFAULT NULL::text, p_home_type text DEFAULT NULL::text) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
    INSERT INTO cleaned_listings (
        run_id, scraped_at, zip_code, zpid,
        address_raw, address_street, address_city, address_state, address_zip,
        price, beds, baths, area, availability_date,
        geom, raw_scrape_id,
        img_src, detail_url, is_building, building_zpid, home_type
    ) VALUES (
        p_run_id, p_scraped_at, p_zip_code, p_zpid,
        p_address_raw, p_address_street, p_address_city, p_address_state, p_address_zip,
        p_price, p_beds, p_baths, p_area, p_availability_date,
        CASE WHEN p_lat IS NOT NULL AND p_lng IS NOT NULL
             THEN ST_SetSRID(ST_Point(p_lng, p_lat), 4326)
             ELSE NULL
        END,
        p_raw_scrape_id,
        p_img_src, p_detail_url, p_is_building, p_building_zpid, p_home_type
    )
    ON CONFLICT (zpid, run_id) DO NOTHING;
END;
$$;


--
-- Name: insert_cleaned_listing(text, timestamp with time zone, text, text, text, text, text, text, text, integer, integer, numeric, integer, date, double precision, double precision, boolean, uuid, text, text, boolean, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.insert_cleaned_listing(p_run_id text, p_scraped_at timestamp with time zone, p_zip_code text, p_zpid text, p_address_raw text, p_address_street text, p_address_city text, p_address_state text, p_address_zip text, p_price integer, p_beds integer, p_baths numeric, p_area integer, p_availability_date date, p_lat double precision, p_lng double precision, p_is_sfr boolean DEFAULT NULL::boolean, p_raw_scrape_id uuid DEFAULT NULL::uuid, p_img_src text DEFAULT NULL::text, p_detail_url text DEFAULT NULL::text, p_is_building boolean DEFAULT false, p_building_zpid text DEFAULT NULL::text, p_home_type text DEFAULT NULL::text) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
    INSERT INTO cleaned_listings (
        run_id, scraped_at, zip_code, zpid,
        address_raw, address_street, address_city, address_state, address_zip,
        price, beds, baths, area, availability_date,
        geom, is_sfr, raw_scrape_id,
        img_src, detail_url, is_building, building_zpid, home_type
    ) VALUES (
        p_run_id, p_scraped_at, p_zip_code, p_zpid,
        p_address_raw, p_address_street, p_address_city, p_address_state, p_address_zip,
        p_price, p_beds, p_baths, p_area, p_availability_date,
        CASE WHEN p_lat IS NOT NULL AND p_lng IS NOT NULL
             THEN ST_SetSRID(ST_Point(p_lng, p_lat), 4326)
             ELSE NULL
        END,
        p_is_sfr, p_raw_scrape_id,
        p_img_src, p_detail_url, p_is_building, p_building_zpid, p_home_type
    )
    ON CONFLICT (zpid, run_id) DO NOTHING;
END;
$$;


--
-- Name: insert_cleaned_listings_bulk(jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.insert_cleaned_listings_bulk(rows jsonb) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
    INSERT INTO cleaned_listings (
        run_id, scraped_at, zip_code, zpid,
        address_raw, address_street, address_city, address_state, address_zip,
        price, beds, baths, area, availability_date,
        geom, raw_scrape_id,
        img_src, detail_url, is_building, building_zpid, home_type, laundry
    )
    SELECT
        r->>'run_id',
        (r->>'scraped_at')::timestamptz,
        r->>'zip_code',
        r->>'zpid',
        r->>'address_raw',
        r->>'address_street',
        r->>'address_city',
        r->>'address_state',
        r->>'address_zip',
        (r->>'price')::int,
        (r->>'beds')::int,
        (r->>'baths')::numeric,
        (r->>'area')::int,
        (r->>'availability_date')::date,
        CASE WHEN r->>'lat' IS NOT NULL AND r->>'lng' IS NOT NULL
             THEN ST_SetSRID(ST_Point((r->>'lng')::float, (r->>'lat')::float), 4326)
             ELSE NULL
        END,
        (r->>'raw_scrape_id')::uuid,
        r->>'img_src',
        r->>'detail_url',
        (r->>'is_building')::boolean,
        NULLIF(r->>'building_zpid', ''),
        NULLIF(r->>'home_type', ''),
        NULLIF(r->>'laundry', '')
    FROM jsonb_array_elements(rows) AS r
    ON CONFLICT (zpid, run_id) DO UPDATE SET
        scraped_at        = EXCLUDED.scraped_at,
        zip_code          = EXCLUDED.zip_code,
        address_raw       = EXCLUDED.address_raw,
        address_street    = EXCLUDED.address_street,
        address_city      = EXCLUDED.address_city,
        address_state     = EXCLUDED.address_state,
        address_zip       = EXCLUDED.address_zip,
        price             = EXCLUDED.price,
        beds              = EXCLUDED.beds,
        baths             = EXCLUDED.baths,
        area              = EXCLUDED.area,
        geom              = EXCLUDED.geom,
        img_src           = EXCLUDED.img_src,
        detail_url        = EXCLUDED.detail_url,
        is_building       = EXCLUDED.is_building,
        building_zpid     = EXCLUDED.building_zpid,
        home_type         = EXCLUDED.home_type,
        laundry           = EXCLUDED.laundry;
END;
$$;


--
-- Name: link_system_account_profile(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.link_system_account_profile(user_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
begin
    insert into profiles (id, full_name, is_admin)
    values (user_id, 'OpenMidmarket', false) -- pragma: allowlist secret
    on conflict (id) do update
    set full_name = 'OpenMidmarket'; -- pragma: allowlist secret
end;
$$;


--
-- Name: search_msas(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.search_msas(p_query text) RETURNS TABLE(id bigint, name text, name_lsad text, geoid text)
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
  SELECT id, name, name_lsad, geoid
  FROM msa_boundaries
  WHERE (name || ' ' || name_lsad) ILIKE '%' || regexp_replace(p_query, '[,\s]+', ' ', 'g') || '%'
  ORDER BY
    CASE WHEN name ILIKE '%' || regexp_replace(p_query, '[,\s]+', ' ', 'g') || '%' THEN 0 ELSE 1 END,
    name
  LIMIT 8;
$$;


--
-- Name: search_neighborhoods(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.search_neighborhoods(p_query text) RETURNS TABLE(id integer, name character varying, city character varying, state character varying)
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
  SELECT id, name, city, state
  FROM neighborhoods
  WHERE (name || ' ' || city || ' ' || state) ILIKE '%' || regexp_replace(p_query, '[,\s]+', ' ', 'g') || '%'
  ORDER BY
    CASE WHEN name ILIKE '%' || regexp_replace(p_query, '[,\s]+', ' ', 'g') || '%' THEN 0 ELSE 1 END,
    name
  LIMIT 8;
$$;


--
-- Name: update_groups_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_groups_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$;


--
-- Name: update_kanban_columns_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_kanban_columns_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$;


--
-- Name: update_people_board_assignments_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_people_board_assignments_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$;


--
-- Name: update_people_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_people_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: _prisma_migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public._prisma_migrations (
    id character varying(36) NOT NULL,
    checksum character varying(64) NOT NULL,
    finished_at timestamp with time zone,
    migration_name character varying(255) NOT NULL,
    logs text,
    rolled_back_at timestamp with time zone,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    applied_steps_count integer DEFAULT 0 NOT NULL
);


--
-- Name: article_cities; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.article_cities (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    article_id uuid NOT NULL,
    city text NOT NULL
);


--
-- Name: article_counties; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.article_counties (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    article_id uuid NOT NULL,
    county_id uuid NOT NULL
);


--
-- Name: article_tags; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.article_tags (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    article_id uuid NOT NULL,
    tag text NOT NULL
);


--
-- Name: articles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.articles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    link text NOT NULL,
    title text NOT NULL,
    date timestamp with time zone NOT NULL,
    image_url text,
    description text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    source_id text NOT NULL,
    is_categorized boolean DEFAULT false NOT NULL,
    is_relevant boolean DEFAULT true NOT NULL
);


--
-- Name: counties; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.counties (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: sources; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sources (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    source_id text NOT NULL,
    source_name text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    url text,
    type text,
    disabled boolean DEFAULT false NOT NULL,
    is_national boolean DEFAULT false NOT NULL
);


--
-- Name: article_details; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.article_details AS
 SELECT a.id AS article_id,
    a.title,
    a.link,
    a.description,
    a.date,
    a.is_relevant,
    a.image_url,
    s.source_name,
    COALESCE(json_agg(DISTINCT at.tag ORDER BY at.tag) FILTER (WHERE (at.tag IS NOT NULL)), '[]'::json) AS tags,
    COALESCE(json_agg(DISTINCT ac.city ORDER BY ac.city) FILTER (WHERE (ac.city IS NOT NULL)), '[]'::json) AS cities,
    COALESCE(json_agg(DISTINCT c.name ORDER BY c.name) FILTER (WHERE (c.name IS NOT NULL)), '[]'::json) AS counties
   FROM (((((public.articles a
     LEFT JOIN public.article_tags at ON ((a.id = at.article_id)))
     LEFT JOIN public.article_cities ac ON ((a.id = ac.article_id)))
     LEFT JOIN public.article_counties aco ON ((a.id = aco.article_id)))
     LEFT JOIN public.counties c ON ((aco.county_id = c.id)))
     LEFT JOIN public.sources s ON ((a.source_id = s.source_id)))
  GROUP BY a.id, a.title, a.link, a.description, a.date, a.is_relevant, a.image_url, s.source_name
  ORDER BY a.date DESC, a.title;


--
-- Name: cities; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cities (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    state text NOT NULL,
    state_abbr text NOT NULL,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: city_boundaries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.city_boundaries (
    id bigint NOT NULL,
    geoid text NOT NULL,
    name text NOT NULL,
    name_lsad text,
    state_fips text,
    state text,
    lsad text,
    geom public.geometry(MultiPolygon,4326)
);


--
-- Name: city_boundaries_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.city_boundaries_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: city_boundaries_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.city_boundaries_id_seq OWNED BY public.city_boundaries.id;


--
-- Name: cleaned_listings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cleaned_listings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    run_id text NOT NULL,
    scraped_at timestamp with time zone NOT NULL,
    zip_code text NOT NULL,
    zpid text NOT NULL,
    address_raw text,
    address_street text,
    address_city text,
    address_state text,
    address_zip text,
    price integer,
    beds integer,
    baths numeric,
    area integer,
    availability_date date,
    geom public.geometry(Point,4326),
    created_at timestamp with time zone DEFAULT now(),
    raw_scrape_id uuid,
    latitude double precision GENERATED ALWAYS AS (public.st_y(geom)) STORED,
    longitude double precision GENERATED ALWAYS AS (public.st_x(geom)) STORED,
    img_src text,
    detail_url text,
    is_building boolean DEFAULT false,
    building_zpid text,
    home_type text,
    laundry text,
    CONSTRAINT cleaned_listings_laundry_check CHECK ((laundry = ANY (ARRAY['in_unit'::text, 'shared'::text, 'none'::text])))
);


--
-- Name: comments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.comments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    post_id uuid NOT NULL,
    user_id uuid NOT NULL,
    content text NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);


--
-- Name: county_boundaries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.county_boundaries (
    id bigint NOT NULL,
    geoid text NOT NULL,
    name text NOT NULL,
    name_lsad text,
    state_fips text,
    state text,
    geom public.geometry(MultiPolygon,4326)
);


--
-- Name: county_boundaries_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.county_boundaries_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: county_boundaries_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.county_boundaries_id_seq OWNED BY public.county_boundaries.id;


--
-- Name: event_blasts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.event_blasts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    event_id uuid NOT NULL,
    user_id uuid NOT NULL,
    subject text NOT NULL,
    message text NOT NULL,
    recipient_count integer NOT NULL,
    sent_count integer NOT NULL,
    failed_count integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: event_invites; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.event_invites (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    event_id uuid NOT NULL,
    user_id uuid NOT NULL,
    message text,
    recipient_count integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    recipient_emails text[] DEFAULT '{}'::text[]
);


--
-- Name: event_registrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.event_registrations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    event_id uuid NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);


--
-- Name: events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    title text NOT NULL,
    description text,
    start_time timestamp with time zone NOT NULL,
    end_time timestamp with time zone NOT NULL,
    location text,
    color text DEFAULT 'blue'::text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    image_url text,
    meet_link text,
    CONSTRAINT events_color_check CHECK ((color = ANY (ARRAY['black'::text, 'blue'::text, 'green'::text, 'purple'::text, 'red'::text, 'orange'::text])))
);


--
-- Name: groups; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.groups (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    name text NOT NULL,
    color text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT name_not_empty CHECK ((char_length(TRIM(BOTH FROM name)) > 0))
);


--
-- Name: integrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.integrations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    nylas_grant_id text NOT NULL,
    provider text NOT NULL,
    email_address text NOT NULL,
    integration_type text NOT NULL,
    status text DEFAULT 'active'::text,
    first_sync_at timestamp with time zone,
    last_sync_at timestamp with time zone,
    sync_error text,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: interactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.interactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    person_id uuid,
    integration_id uuid,
    interaction_type text NOT NULL,
    subject text,
    occurred_at timestamp with time zone NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: kanban_columns; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.kanban_columns (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    columns text[] DEFAULT ARRAY['Active Prospecting'::text, 'Offering Memorandum'::text, 'Underwriting'::text, 'Due Diligence'::text, 'Closed/Archive'::text] NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);


--
-- Name: likes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.likes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    post_id uuid NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);


--
-- Name: loopnet_listings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.loopnet_listings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    listing_url text NOT NULL,
    thumbnail_url text,
    broker_logo_url text,
    address text,
    headline text,
    location text,
    price text,
    cap_rate text,
    building_category text,
    square_footage text,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP,
    latitude double precision,
    longitude double precision,
    description text,
    date_on_market date,
    price_per_unit text,
    grm text,
    num_units integer,
    property_subtype text,
    apartment_style text,
    building_class text,
    lot_size text,
    building_size text,
    num_stories integer,
    year_built integer,
    zoning text,
    scraped_at timestamp with time zone DEFAULT now() NOT NULL,
    run_id integer
);


--
-- Name: messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    sender_id uuid NOT NULL,
    recipient_id uuid NOT NULL,
    content text NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    read_at timestamp with time zone,
    CONSTRAINT content_not_empty CHECK ((char_length(TRIM(BOTH FROM content)) > 0))
);


--
-- Name: msa_boundaries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.msa_boundaries (
    id bigint NOT NULL,
    geoid text NOT NULL,
    name text NOT NULL,
    name_lsad text,
    geom public.geometry(MultiPolygon,4326)
);


--
-- Name: msa_boundaries_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.msa_boundaries_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: msa_boundaries_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.msa_boundaries_id_seq OWNED BY public.msa_boundaries.id;


--
-- Name: neighborhoods; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.neighborhoods (
    id integer NOT NULL,
    state character varying(80),
    county character varying(80),
    city character varying(80),
    name character varying(80),
    regionid character varying(80),
    shape_length double precision,
    shape_area double precision,
    geom public.geometry(MultiPolygon,4326)
);


--
-- Name: newsletter_articles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.newsletter_articles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    newsletter_id uuid NOT NULL,
    article_id uuid NOT NULL
);


--
-- Name: newsletters; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.newsletters (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    subscriber_email text NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    sent_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    campaign_id text,
    subject text,
    scheduled_send_at timestamp with time zone
);


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    type text DEFAULT 'message'::text NOT NULL,
    title text,
    content text NOT NULL,
    related_id uuid,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    read_at timestamp with time zone,
    CONSTRAINT content_not_empty CHECK ((char_length(TRIM(BOTH FROM content)) > 0)),
    CONSTRAINT valid_type CHECK ((type = ANY (ARRAY['message'::text, 'system'::text, 'mention'::text, 'like'::text, 'comment'::text])))
);


--
-- Name: people; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.people (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    name text NOT NULL,
    starred boolean DEFAULT false NOT NULL,
    signal boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    email text,
    timeline jsonb DEFAULT '[]'::jsonb,
    address text,
    owned_addresses jsonb DEFAULT '[]'::jsonb,
    phone text,
    category text,
    address_latitude numeric,
    address_longitude numeric,
    owned_addresses_geo jsonb DEFAULT '[]'::jsonb,
    bio text,
    birthday date,
    linkedin_url text,
    twitter_url text,
    instagram_url text,
    facebook_url text,
    network_strength text DEFAULT 'MEDIUM'::text,
    CONSTRAINT people_category_check CHECK (((category IS NULL) OR (category = ANY (ARRAY['Property Owner'::text, 'Lender'::text, 'Realtor'::text])))),
    CONSTRAINT people_network_strength_check CHECK ((network_strength = ANY (ARRAY['HIGH'::text, 'MEDIUM'::text, 'LOW'::text])))
);


--
-- Name: people_board_assignments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.people_board_assignments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    person_id uuid NOT NULL,
    column_id text NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);


--
-- Name: people_groups; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.people_groups (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    person_id uuid NOT NULL,
    group_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);


--
-- Name: people_relationships; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.people_relationships (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    person_id uuid NOT NULL,
    related_person_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT no_self_relationship CHECK ((person_id <> related_person_id))
);


--
-- Name: posts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.posts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    type text DEFAULT 'post'::text,
    content text NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    file_url text,
    CONSTRAINT posts_type_check CHECK ((type = ANY (ARRAY['post'::text, 'article'::text, 'link'::text])))
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    updated_at timestamp with time zone,
    full_name text,
    avatar_url text,
    website text,
    roles text[],
    is_admin boolean DEFAULT false NOT NULL,
    theme_preference text DEFAULT 'system'::text,
    newsletter_active boolean DEFAULT false,
    newsletter_interests text,
    newsletter_timezone text DEFAULT 'America/Los_Angeles'::text,
    newsletter_preferred_send_times jsonb DEFAULT '[]'::jsonb,
    newsletter_subscribed_at timestamp with time zone,
    subscriber_id uuid,
    tour_visited_pages jsonb DEFAULT '[]'::jsonb,
    CONSTRAINT profiles_theme_preference_check CHECK ((theme_preference = ANY (ARRAY['light'::text, 'dark'::text, 'system'::text])))
);


--
-- Name: COLUMN profiles.roles; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.profiles.roles IS 'Array of user roles. Valid roles: Property Owner, Broker, Lender';


--
-- Name: COLUMN profiles.is_admin; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.profiles.is_admin IS 'Indicates if the user has admin privileges';


--
-- Name: raw_building_details; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.raw_building_details (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    run_id text NOT NULL,
    scraped_at timestamp with time zone NOT NULL,
    building_zpid text NOT NULL,
    detail_url text NOT NULL,
    raw_json jsonb,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: raw_zillow_scrapes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.raw_zillow_scrapes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    zip_code text NOT NULL,
    scraped_at timestamp with time zone NOT NULL,
    run_id text NOT NULL,
    raw_json jsonb NOT NULL
);


--
-- Name: subscriber_cities; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subscriber_cities (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    subscriber_id uuid NOT NULL,
    city_id uuid NOT NULL
);


--
-- Name: subscriber_counties; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subscriber_counties (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    subscriber_id uuid NOT NULL,
    county_id uuid NOT NULL
);


--
-- Name: subscriber_other_locations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subscriber_other_locations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    subscriber_id uuid NOT NULL,
    location text NOT NULL
);


--
-- Name: subscribers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subscribers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email text NOT NULL,
    full_name text NOT NULL,
    subscribed_at timestamp with time zone DEFAULT now(),
    is_active boolean DEFAULT true,
    interests text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    timezone text,
    preferred_send_times jsonb
);


--
-- Name: zillow_listings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.zillow_listings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    zpid text,
    detail_url text,
    address text,
    address_city text,
    address_state text,
    address_street text,
    address_zipcode text,
    building_name text,
    area text,
    availability_count text,
    availability_date timestamp(6) with time zone,
    baths text,
    beds text,
    price text,
    zestimate text,
    latitude double precision,
    longitude double precision,
    home_status text,
    home_type text,
    living_area text,
    rent_zestimate text,
    tax_assessed_value text,
    days_on_zillow text,
    raw_data jsonb,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP,
    snapshot_date timestamp(6) with time zone NOT NULL
);


--
-- Name: zillow_neighborhoods_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.zillow_neighborhoods_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: zillow_neighborhoods_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.zillow_neighborhoods_id_seq OWNED BY public.neighborhoods.id;


--
-- Name: zip_codes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.zip_codes (
    zip text NOT NULL,
    po_name text NOT NULL,
    state text NOT NULL,
    active boolean DEFAULT true NOT NULL,
    geom public.geometry(MultiPolygon,4326),
    area numeric,
    length numeric
);


--
-- Name: city_boundaries id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.city_boundaries ALTER COLUMN id SET DEFAULT nextval('public.city_boundaries_id_seq'::regclass);


--
-- Name: county_boundaries id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.county_boundaries ALTER COLUMN id SET DEFAULT nextval('public.county_boundaries_id_seq'::regclass);


--
-- Name: msa_boundaries id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.msa_boundaries ALTER COLUMN id SET DEFAULT nextval('public.msa_boundaries_id_seq'::regclass);


--
-- Name: neighborhoods id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.neighborhoods ALTER COLUMN id SET DEFAULT nextval('public.zillow_neighborhoods_id_seq'::regclass);


--
-- Name: _prisma_migrations _prisma_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public._prisma_migrations
    ADD CONSTRAINT _prisma_migrations_pkey PRIMARY KEY (id);


--
-- Name: article_cities article_cities_article_id_city_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.article_cities
    ADD CONSTRAINT article_cities_article_id_city_key UNIQUE (article_id, city);


--
-- Name: article_cities article_cities_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.article_cities
    ADD CONSTRAINT article_cities_pkey PRIMARY KEY (id);


--
-- Name: article_counties article_counties_article_id_county_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.article_counties
    ADD CONSTRAINT article_counties_article_id_county_id_key UNIQUE (article_id, county_id);


--
-- Name: article_counties article_counties_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.article_counties
    ADD CONSTRAINT article_counties_pkey PRIMARY KEY (id);


--
-- Name: article_tags article_tags_article_id_tag_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.article_tags
    ADD CONSTRAINT article_tags_article_id_tag_key UNIQUE (article_id, tag);


--
-- Name: article_tags article_tags_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.article_tags
    ADD CONSTRAINT article_tags_pkey PRIMARY KEY (id);


--
-- Name: articles articles_link_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.articles
    ADD CONSTRAINT articles_link_key UNIQUE (link);


--
-- Name: articles articles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.articles
    ADD CONSTRAINT articles_pkey PRIMARY KEY (id);


--
-- Name: cities cities_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cities
    ADD CONSTRAINT cities_pkey PRIMARY KEY (id);


--
-- Name: city_boundaries city_boundaries_geoid_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.city_boundaries
    ADD CONSTRAINT city_boundaries_geoid_key UNIQUE (geoid);


--
-- Name: city_boundaries city_boundaries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.city_boundaries
    ADD CONSTRAINT city_boundaries_pkey PRIMARY KEY (id);


--
-- Name: cleaned_listings cleaned_listings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cleaned_listings
    ADD CONSTRAINT cleaned_listings_pkey PRIMARY KEY (id);


--
-- Name: cleaned_listings cleaned_listings_zpid_run_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cleaned_listings
    ADD CONSTRAINT cleaned_listings_zpid_run_id_key UNIQUE (zpid, run_id);


--
-- Name: comments comments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comments
    ADD CONSTRAINT comments_pkey PRIMARY KEY (id);


--
-- Name: counties counties_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.counties
    ADD CONSTRAINT counties_pkey PRIMARY KEY (id);


--
-- Name: county_boundaries county_boundaries_geoid_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.county_boundaries
    ADD CONSTRAINT county_boundaries_geoid_key UNIQUE (geoid);


--
-- Name: county_boundaries county_boundaries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.county_boundaries
    ADD CONSTRAINT county_boundaries_pkey PRIMARY KEY (id);


--
-- Name: event_blasts event_blasts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_blasts
    ADD CONSTRAINT event_blasts_pkey PRIMARY KEY (id);


--
-- Name: event_invites event_invites_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_invites
    ADD CONSTRAINT event_invites_pkey PRIMARY KEY (id);


--
-- Name: event_registrations event_registrations_event_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_registrations
    ADD CONSTRAINT event_registrations_event_id_user_id_key UNIQUE (event_id, user_id);


--
-- Name: event_registrations event_registrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_registrations
    ADD CONSTRAINT event_registrations_pkey PRIMARY KEY (id);


--
-- Name: events events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_pkey PRIMARY KEY (id);


--
-- Name: groups groups_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.groups
    ADD CONSTRAINT groups_pkey PRIMARY KEY (id);


--
-- Name: integrations integrations_nylas_grant_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.integrations
    ADD CONSTRAINT integrations_nylas_grant_id_key UNIQUE (nylas_grant_id);


--
-- Name: integrations integrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.integrations
    ADD CONSTRAINT integrations_pkey PRIMARY KEY (id);


--
-- Name: interactions interactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.interactions
    ADD CONSTRAINT interactions_pkey PRIMARY KEY (id);


--
-- Name: kanban_columns kanban_columns_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kanban_columns
    ADD CONSTRAINT kanban_columns_pkey PRIMARY KEY (id);


--
-- Name: kanban_columns kanban_columns_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kanban_columns
    ADD CONSTRAINT kanban_columns_user_id_key UNIQUE (user_id);


--
-- Name: likes likes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.likes
    ADD CONSTRAINT likes_pkey PRIMARY KEY (id);


--
-- Name: likes likes_post_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.likes
    ADD CONSTRAINT likes_post_id_user_id_key UNIQUE (post_id, user_id);


--
-- Name: loopnet_listings loopnet_listings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loopnet_listings
    ADD CONSTRAINT loopnet_listings_pkey PRIMARY KEY (id);


--
-- Name: messages messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_pkey PRIMARY KEY (id);


--
-- Name: msa_boundaries msa_boundaries_geoid_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.msa_boundaries
    ADD CONSTRAINT msa_boundaries_geoid_key UNIQUE (geoid);


--
-- Name: msa_boundaries msa_boundaries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.msa_boundaries
    ADD CONSTRAINT msa_boundaries_pkey PRIMARY KEY (id);


--
-- Name: newsletter_articles newsletter_articles_newsletter_id_article_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.newsletter_articles
    ADD CONSTRAINT newsletter_articles_newsletter_id_article_id_key UNIQUE (newsletter_id, article_id);


--
-- Name: newsletter_articles newsletter_articles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.newsletter_articles
    ADD CONSTRAINT newsletter_articles_pkey PRIMARY KEY (id);


--
-- Name: newsletters newsletters_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.newsletters
    ADD CONSTRAINT newsletters_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: people_board_assignments people_board_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.people_board_assignments
    ADD CONSTRAINT people_board_assignments_pkey PRIMARY KEY (id);


--
-- Name: people_board_assignments people_board_assignments_user_id_person_id_column_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.people_board_assignments
    ADD CONSTRAINT people_board_assignments_user_id_person_id_column_id_key UNIQUE (user_id, person_id, column_id);


--
-- Name: people_groups people_groups_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.people_groups
    ADD CONSTRAINT people_groups_pkey PRIMARY KEY (id);


--
-- Name: people people_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.people
    ADD CONSTRAINT people_pkey PRIMARY KEY (id);


--
-- Name: people_relationships people_relationships_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.people_relationships
    ADD CONSTRAINT people_relationships_pkey PRIMARY KEY (id);


--
-- Name: posts posts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.posts
    ADD CONSTRAINT posts_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: raw_building_details raw_building_details_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.raw_building_details
    ADD CONSTRAINT raw_building_details_pkey PRIMARY KEY (id);


--
-- Name: raw_zillow_scrapes raw_zillow_scrapes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.raw_zillow_scrapes
    ADD CONSTRAINT raw_zillow_scrapes_pkey PRIMARY KEY (id);


--
-- Name: sources sources_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sources
    ADD CONSTRAINT sources_pkey PRIMARY KEY (id);


--
-- Name: sources sources_source_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sources
    ADD CONSTRAINT sources_source_id_key UNIQUE (source_id);


--
-- Name: subscriber_cities subscriber_cities_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriber_cities
    ADD CONSTRAINT subscriber_cities_pkey PRIMARY KEY (id);


--
-- Name: subscriber_counties subscriber_counties_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriber_counties
    ADD CONSTRAINT subscriber_counties_pkey PRIMARY KEY (id);


--
-- Name: subscriber_counties subscriber_counties_subscriber_id_county_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriber_counties
    ADD CONSTRAINT subscriber_counties_subscriber_id_county_id_key UNIQUE (subscriber_id, county_id);


--
-- Name: subscriber_other_locations subscriber_other_locations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriber_other_locations
    ADD CONSTRAINT subscriber_other_locations_pkey PRIMARY KEY (id);


--
-- Name: subscriber_other_locations subscriber_other_locations_subscriber_id_location_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriber_other_locations
    ADD CONSTRAINT subscriber_other_locations_subscriber_id_location_key UNIQUE (subscriber_id, location);


--
-- Name: subscribers subscribers_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscribers
    ADD CONSTRAINT subscribers_email_key UNIQUE (email);


--
-- Name: subscribers subscribers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscribers
    ADD CONSTRAINT subscribers_pkey PRIMARY KEY (id);


--
-- Name: people_groups unique_person_group; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.people_groups
    ADD CONSTRAINT unique_person_group UNIQUE (person_id, group_id);


--
-- Name: people_relationships unique_relationship; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.people_relationships
    ADD CONSTRAINT unique_relationship UNIQUE (person_id, related_person_id);


--
-- Name: zillow_listings zillow_listings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.zillow_listings
    ADD CONSTRAINT zillow_listings_pkey PRIMARY KEY (id);


--
-- Name: neighborhoods zillow_neighborhoods_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.neighborhoods
    ADD CONSTRAINT zillow_neighborhoods_pkey PRIMARY KEY (id);


--
-- Name: zip_codes zip_codes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.zip_codes
    ADD CONSTRAINT zip_codes_pkey PRIMARY KEY (zip);


--
-- Name: cities_name_state_abbr_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX cities_name_state_abbr_key ON public.cities USING btree (name, state_abbr);


--
-- Name: cleaned_listings_geom_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cleaned_listings_geom_idx ON public.cleaned_listings USING gist (geom);


--
-- Name: cleaned_listings_zip_run_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cleaned_listings_zip_run_idx ON public.cleaned_listings USING btree (zip_code, run_id);


--
-- Name: comments_post_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX comments_post_id_idx ON public.comments USING btree (post_id);


--
-- Name: comments_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX comments_user_id_idx ON public.comments USING btree (user_id);


--
-- Name: counties_name_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX counties_name_key ON public.counties USING btree (name);


--
-- Name: event_registrations_event_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX event_registrations_event_id_idx ON public.event_registrations USING btree (event_id);


--
-- Name: event_registrations_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX event_registrations_user_id_idx ON public.event_registrations USING btree (user_id);


--
-- Name: events_start_time_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX events_start_time_idx ON public.events USING btree (start_time);


--
-- Name: events_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX events_user_id_idx ON public.events USING btree (user_id);


--
-- Name: groups_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX groups_created_at_idx ON public.groups USING btree (created_at DESC);


--
-- Name: groups_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX groups_user_id_idx ON public.groups USING btree (user_id);


--
-- Name: idx_article_cities_article_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_article_cities_article_id ON public.article_cities USING btree (article_id);


--
-- Name: idx_article_cities_city; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_article_cities_city ON public.article_cities USING btree (city);


--
-- Name: idx_article_counties_article_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_article_counties_article_id ON public.article_counties USING btree (article_id);


--
-- Name: idx_article_counties_county_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_article_counties_county_id ON public.article_counties USING btree (county_id);


--
-- Name: idx_article_tags_article_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_article_tags_article_id ON public.article_tags USING btree (article_id);


--
-- Name: idx_article_tags_tag; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_article_tags_tag ON public.article_tags USING btree (tag);


--
-- Name: idx_articles_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_articles_date ON public.articles USING btree (date);


--
-- Name: idx_articles_is_categorized; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_articles_is_categorized ON public.articles USING btree (is_categorized);


--
-- Name: idx_articles_is_relevant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_articles_is_relevant ON public.articles USING btree (is_relevant);


--
-- Name: idx_articles_link; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_articles_link ON public.articles USING btree (link);


--
-- Name: idx_cities_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cities_name ON public.cities USING btree (name);


--
-- Name: idx_city_boundaries_geom; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_city_boundaries_geom ON public.city_boundaries USING gist (geom);


--
-- Name: idx_city_boundaries_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_city_boundaries_name ON public.city_boundaries USING btree (name, state);


--
-- Name: idx_city_boundaries_state; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_city_boundaries_state ON public.city_boundaries USING btree (state);


--
-- Name: idx_cleaned_listings_city_state_lower; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cleaned_listings_city_state_lower ON public.cleaned_listings USING btree (lower(address_city), lower(address_state));


--
-- Name: idx_cleaned_listings_geom; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cleaned_listings_geom ON public.cleaned_listings USING gist (geom) WHERE (geom IS NOT NULL);


--
-- Name: idx_cleaned_listings_run_id_desc; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cleaned_listings_run_id_desc ON public.cleaned_listings USING btree (run_id DESC);


--
-- Name: idx_counties_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_counties_name ON public.counties USING btree (name);


--
-- Name: idx_county_boundaries_geom; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_county_boundaries_geom ON public.county_boundaries USING gist (geom);


--
-- Name: idx_county_boundaries_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_county_boundaries_name ON public.county_boundaries USING btree (name, state);


--
-- Name: idx_county_boundaries_state; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_county_boundaries_state ON public.county_boundaries USING btree (state);


--
-- Name: idx_event_blasts_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_event_blasts_created_at ON public.event_blasts USING btree (created_at DESC);


--
-- Name: idx_event_blasts_event_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_event_blasts_event_id ON public.event_blasts USING btree (event_id);


--
-- Name: idx_event_blasts_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_event_blasts_user_id ON public.event_blasts USING btree (user_id);


--
-- Name: idx_event_invites_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_event_invites_created_at ON public.event_invites USING btree (created_at DESC);


--
-- Name: idx_event_invites_event_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_event_invites_event_id ON public.event_invites USING btree (event_id);


--
-- Name: idx_integrations_nylas_grant_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_integrations_nylas_grant_id ON public.integrations USING btree (nylas_grant_id);


--
-- Name: idx_integrations_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_integrations_user_id ON public.integrations USING btree (user_id);


--
-- Name: idx_interactions_occurred_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_interactions_occurred_at ON public.interactions USING btree (occurred_at DESC);


--
-- Name: idx_interactions_person_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_interactions_person_id ON public.interactions USING btree (person_id);


--
-- Name: idx_interactions_unique_calendar; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_interactions_unique_calendar ON public.interactions USING btree (user_id, person_id, ((metadata ->> 'event_id'::text))) WHERE ((metadata ->> 'event_id'::text) IS NOT NULL);


--
-- Name: idx_interactions_unique_email; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_interactions_unique_email ON public.interactions USING btree (user_id, person_id, ((metadata ->> 'message_id'::text))) WHERE ((metadata ->> 'message_id'::text) IS NOT NULL);


--
-- Name: idx_interactions_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_interactions_user_id ON public.interactions USING btree (user_id);


--
-- Name: idx_loopnet_listings_listing_url; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_loopnet_listings_listing_url ON public.loopnet_listings USING btree (listing_url);


--
-- Name: idx_msa_boundaries_geom; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_msa_boundaries_geom ON public.msa_boundaries USING gist (geom);


--
-- Name: idx_msa_boundaries_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_msa_boundaries_name ON public.msa_boundaries USING btree (name);


--
-- Name: idx_neighborhoods_geom; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_neighborhoods_geom ON public.neighborhoods USING gist (geom);


--
-- Name: idx_newsletter_articles_article_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_newsletter_articles_article_id ON public.newsletter_articles USING btree (article_id);


--
-- Name: idx_newsletter_articles_newsletter_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_newsletter_articles_newsletter_id ON public.newsletter_articles USING btree (newsletter_id);


--
-- Name: idx_newsletters_campaign_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_newsletters_campaign_id ON public.newsletters USING btree (campaign_id);


--
-- Name: idx_newsletters_scheduled_send_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_newsletters_scheduled_send_at ON public.newsletters USING btree (scheduled_send_at);


--
-- Name: idx_newsletters_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_newsletters_status ON public.newsletters USING btree (status);


--
-- Name: idx_newsletters_status_scheduled; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_newsletters_status_scheduled ON public.newsletters USING btree (status, scheduled_send_at);


--
-- Name: idx_newsletters_subscriber_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_newsletters_subscriber_email ON public.newsletters USING btree (subscriber_email);


--
-- Name: idx_people_network_strength; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_people_network_strength ON public.people USING btree (user_id, network_strength);


--
-- Name: idx_profiles_newsletter_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profiles_newsletter_active ON public.profiles USING btree (newsletter_active);


--
-- Name: idx_profiles_subscriber_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profiles_subscriber_id ON public.profiles USING btree (subscriber_id);


--
-- Name: idx_sources_source_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sources_source_id ON public.sources USING btree (source_id);


--
-- Name: idx_sources_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sources_type ON public.sources USING btree (type);


--
-- Name: idx_subscriber_cities_city_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscriber_cities_city_id ON public.subscriber_cities USING btree (city_id);


--
-- Name: idx_subscriber_cities_subscriber_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscriber_cities_subscriber_id ON public.subscriber_cities USING btree (subscriber_id);


--
-- Name: idx_subscriber_counties_county_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscriber_counties_county_id ON public.subscriber_counties USING btree (county_id);


--
-- Name: idx_subscriber_counties_subscriber_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscriber_counties_subscriber_id ON public.subscriber_counties USING btree (subscriber_id);


--
-- Name: idx_subscriber_other_locations_location; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscriber_other_locations_location ON public.subscriber_other_locations USING btree (location);


--
-- Name: idx_subscriber_other_locations_subscriber_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscriber_other_locations_subscriber_id ON public.subscriber_other_locations USING btree (subscriber_id);


--
-- Name: idx_subscribers_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscribers_email ON public.subscribers USING btree (email);


--
-- Name: idx_subscribers_is_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscribers_is_active ON public.subscribers USING btree (is_active);


--
-- Name: idx_zillow_listings_detail_url; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_zillow_listings_detail_url ON public.zillow_listings USING btree (detail_url);


--
-- Name: idx_zillow_listings_location; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_zillow_listings_location ON public.zillow_listings USING btree (address_city, address_state);


--
-- Name: idx_zillow_listings_snapshot_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_zillow_listings_snapshot_date ON public.zillow_listings USING btree (snapshot_date);


--
-- Name: idx_zillow_listings_zpid; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_zillow_listings_zpid ON public.zillow_listings USING btree (zpid);


--
-- Name: idx_zillow_listings_zpid_snapshot; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_zillow_listings_zpid_snapshot ON public.zillow_listings USING btree (zpid, snapshot_date);


--
-- Name: kanban_columns_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX kanban_columns_user_id_idx ON public.kanban_columns USING btree (user_id);


--
-- Name: likes_post_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX likes_post_id_idx ON public.likes USING btree (post_id);


--
-- Name: likes_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX likes_user_id_idx ON public.likes USING btree (user_id);


--
-- Name: loopnet_listings_listing_url_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX loopnet_listings_listing_url_key ON public.loopnet_listings USING btree (listing_url);


--
-- Name: messages_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX messages_created_at_idx ON public.messages USING btree (created_at DESC);


--
-- Name: messages_recipient_sender_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX messages_recipient_sender_idx ON public.messages USING btree (recipient_id, sender_id);


--
-- Name: messages_sender_recipient_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX messages_sender_recipient_idx ON public.messages USING btree (sender_id, recipient_id);


--
-- Name: notifications_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX notifications_created_at_idx ON public.notifications USING btree (created_at DESC);


--
-- Name: notifications_type_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX notifications_type_idx ON public.notifications USING btree (type);


--
-- Name: notifications_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX notifications_user_id_idx ON public.notifications USING btree (user_id);


--
-- Name: notifications_user_unread_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX notifications_user_unread_idx ON public.notifications USING btree (user_id, read_at) WHERE (read_at IS NULL);


--
-- Name: people_board_assignments_column_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX people_board_assignments_column_id_idx ON public.people_board_assignments USING btree (column_id);


--
-- Name: people_board_assignments_person_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX people_board_assignments_person_id_idx ON public.people_board_assignments USING btree (person_id);


--
-- Name: people_board_assignments_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX people_board_assignments_user_id_idx ON public.people_board_assignments USING btree (user_id);


--
-- Name: people_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX people_created_at_idx ON public.people USING btree (created_at DESC);


--
-- Name: people_groups_group_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX people_groups_group_id_idx ON public.people_groups USING btree (group_id);


--
-- Name: people_groups_person_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX people_groups_person_id_idx ON public.people_groups USING btree (person_id);


--
-- Name: people_relationships_person_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX people_relationships_person_id_idx ON public.people_relationships USING btree (person_id);


--
-- Name: people_relationships_related_person_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX people_relationships_related_person_id_idx ON public.people_relationships USING btree (related_person_id);


--
-- Name: people_relationships_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX people_relationships_user_id_idx ON public.people_relationships USING btree (user_id);


--
-- Name: people_starred_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX people_starred_idx ON public.people USING btree (user_id, starred) WHERE (starred = true);


--
-- Name: people_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX people_user_id_idx ON public.people USING btree (user_id);


--
-- Name: posts_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX posts_created_at_idx ON public.posts USING btree (created_at DESC);


--
-- Name: posts_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX posts_user_id_idx ON public.posts USING btree (user_id);


--
-- Name: profiles_is_admin_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX profiles_is_admin_idx ON public.profiles USING btree (is_admin) WHERE (is_admin = true);


--
-- Name: raw_zillow_scrapes_zip_scraped_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX raw_zillow_scrapes_zip_scraped_at_idx ON public.raw_zillow_scrapes USING btree (zip_code, scraped_at DESC);


--
-- Name: subscriber_cities_subscriber_id_city_id_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX subscriber_cities_subscriber_id_city_id_key ON public.subscriber_cities USING btree (subscriber_id, city_id);


--
-- Name: zillow_neighborhoods_geom_geom_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX zillow_neighborhoods_geom_geom_idx ON public.neighborhoods USING gist (geom);


--
-- Name: groups on_groups_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER on_groups_updated BEFORE UPDATE ON public.groups FOR EACH ROW EXECUTE FUNCTION public.update_groups_updated_at();


--
-- Name: kanban_columns on_kanban_columns_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER on_kanban_columns_updated BEFORE UPDATE ON public.kanban_columns FOR EACH ROW EXECUTE FUNCTION public.update_kanban_columns_updated_at();


--
-- Name: messages on_message_created; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER on_message_created AFTER INSERT ON public.messages FOR EACH ROW EXECUTE FUNCTION public.create_message_notification();


--
-- Name: people_board_assignments on_people_board_assignments_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER on_people_board_assignments_updated BEFORE UPDATE ON public.people_board_assignments FOR EACH ROW EXECUTE FUNCTION public.update_people_board_assignments_updated_at();


--
-- Name: people on_people_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER on_people_updated BEFORE UPDATE ON public.people FOR EACH ROW EXECUTE FUNCTION public.update_people_updated_at();


--
-- Name: events set_events_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_events_updated_at BEFORE UPDATE ON public.events FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


--
-- Name: articles update_articles_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_articles_updated_at BEFORE UPDATE ON public.articles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: sources update_sources_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_sources_updated_at BEFORE UPDATE ON public.sources FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: subscribers update_subscribers_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_subscribers_updated_at BEFORE UPDATE ON public.subscribers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: article_cities article_cities_article_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.article_cities
    ADD CONSTRAINT article_cities_article_id_fkey FOREIGN KEY (article_id) REFERENCES public.articles(id) ON DELETE CASCADE;


--
-- Name: article_counties article_counties_article_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.article_counties
    ADD CONSTRAINT article_counties_article_id_fkey FOREIGN KEY (article_id) REFERENCES public.articles(id) ON DELETE CASCADE;


--
-- Name: article_counties article_counties_county_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.article_counties
    ADD CONSTRAINT article_counties_county_id_fkey FOREIGN KEY (county_id) REFERENCES public.counties(id) ON DELETE CASCADE;


--
-- Name: article_tags article_tags_article_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.article_tags
    ADD CONSTRAINT article_tags_article_id_fkey FOREIGN KEY (article_id) REFERENCES public.articles(id) ON DELETE CASCADE;


--
-- Name: articles articles_source_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.articles
    ADD CONSTRAINT articles_source_id_fkey FOREIGN KEY (source_id) REFERENCES public.sources(source_id);


--
-- Name: cleaned_listings cleaned_listings_raw_scrape_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cleaned_listings
    ADD CONSTRAINT cleaned_listings_raw_scrape_id_fkey FOREIGN KEY (raw_scrape_id) REFERENCES public.raw_zillow_scrapes(id);


--
-- Name: cleaned_listings cleaned_listings_zip_code_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cleaned_listings
    ADD CONSTRAINT cleaned_listings_zip_code_fkey FOREIGN KEY (zip_code) REFERENCES public.zip_codes(zip);


--
-- Name: comments comments_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comments
    ADD CONSTRAINT comments_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.posts(id) ON DELETE CASCADE;


--
-- Name: comments comments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comments
    ADD CONSTRAINT comments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: event_blasts event_blasts_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_blasts
    ADD CONSTRAINT event_blasts_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;


--
-- Name: event_blasts event_blasts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_blasts
    ADD CONSTRAINT event_blasts_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: event_invites event_invites_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_invites
    ADD CONSTRAINT event_invites_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;


--
-- Name: event_invites event_invites_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_invites
    ADD CONSTRAINT event_invites_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: event_registrations event_registrations_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_registrations
    ADD CONSTRAINT event_registrations_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;


--
-- Name: event_registrations event_registrations_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_registrations
    ADD CONSTRAINT event_registrations_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: events events_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: groups groups_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.groups
    ADD CONSTRAINT groups_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: integrations integrations_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.integrations
    ADD CONSTRAINT integrations_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: interactions interactions_integration_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.interactions
    ADD CONSTRAINT interactions_integration_id_fkey FOREIGN KEY (integration_id) REFERENCES public.integrations(id) ON DELETE SET NULL;


--
-- Name: interactions interactions_person_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.interactions
    ADD CONSTRAINT interactions_person_id_fkey FOREIGN KEY (person_id) REFERENCES public.people(id) ON DELETE CASCADE;


--
-- Name: interactions interactions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.interactions
    ADD CONSTRAINT interactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: kanban_columns kanban_columns_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kanban_columns
    ADD CONSTRAINT kanban_columns_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: likes likes_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.likes
    ADD CONSTRAINT likes_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.posts(id) ON DELETE CASCADE;


--
-- Name: likes likes_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.likes
    ADD CONSTRAINT likes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: messages messages_recipient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_recipient_id_fkey FOREIGN KEY (recipient_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: messages messages_sender_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: newsletter_articles newsletter_articles_article_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.newsletter_articles
    ADD CONSTRAINT newsletter_articles_article_id_fkey FOREIGN KEY (article_id) REFERENCES public.articles(id);


--
-- Name: newsletter_articles newsletter_articles_newsletter_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.newsletter_articles
    ADD CONSTRAINT newsletter_articles_newsletter_id_fkey FOREIGN KEY (newsletter_id) REFERENCES public.newsletters(id) ON DELETE CASCADE;


--
-- Name: newsletters newsletters_subscriber_email_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.newsletters
    ADD CONSTRAINT newsletters_subscriber_email_fkey FOREIGN KEY (subscriber_email) REFERENCES public.subscribers(email);


--
-- Name: notifications notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: people_board_assignments people_board_assignments_person_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.people_board_assignments
    ADD CONSTRAINT people_board_assignments_person_id_fkey FOREIGN KEY (person_id) REFERENCES public.people(id) ON DELETE CASCADE;


--
-- Name: people_board_assignments people_board_assignments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.people_board_assignments
    ADD CONSTRAINT people_board_assignments_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: people_groups people_groups_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.people_groups
    ADD CONSTRAINT people_groups_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.groups(id) ON DELETE CASCADE;


--
-- Name: people_groups people_groups_person_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.people_groups
    ADD CONSTRAINT people_groups_person_id_fkey FOREIGN KEY (person_id) REFERENCES public.people(id) ON DELETE CASCADE;


--
-- Name: people_relationships people_relationships_person_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.people_relationships
    ADD CONSTRAINT people_relationships_person_id_fkey FOREIGN KEY (person_id) REFERENCES public.people(id) ON DELETE CASCADE;


--
-- Name: people_relationships people_relationships_related_person_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.people_relationships
    ADD CONSTRAINT people_relationships_related_person_id_fkey FOREIGN KEY (related_person_id) REFERENCES public.people(id) ON DELETE CASCADE;


--
-- Name: people_relationships people_relationships_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.people_relationships
    ADD CONSTRAINT people_relationships_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: people people_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.people
    ADD CONSTRAINT people_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: posts posts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.posts
    ADD CONSTRAINT posts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: raw_zillow_scrapes raw_zillow_scrapes_zip_code_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.raw_zillow_scrapes
    ADD CONSTRAINT raw_zillow_scrapes_zip_code_fkey FOREIGN KEY (zip_code) REFERENCES public.zip_codes(zip);


--
-- Name: subscriber_cities subscriber_cities_city_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriber_cities
    ADD CONSTRAINT subscriber_cities_city_id_fkey FOREIGN KEY (city_id) REFERENCES public.cities(id) ON DELETE CASCADE;


--
-- Name: subscriber_cities subscriber_cities_subscriber_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriber_cities
    ADD CONSTRAINT subscriber_cities_subscriber_id_fkey FOREIGN KEY (subscriber_id) REFERENCES public.subscribers(id) ON DELETE CASCADE;


--
-- Name: subscriber_counties subscriber_counties_county_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriber_counties
    ADD CONSTRAINT subscriber_counties_county_id_fkey FOREIGN KEY (county_id) REFERENCES public.counties(id) ON DELETE CASCADE;


--
-- Name: subscriber_counties subscriber_counties_subscriber_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriber_counties
    ADD CONSTRAINT subscriber_counties_subscriber_id_fkey FOREIGN KEY (subscriber_id) REFERENCES public.subscribers(id) ON DELETE CASCADE;


--
-- Name: subscriber_other_locations subscriber_other_locations_subscriber_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriber_other_locations
    ADD CONSTRAINT subscriber_other_locations_subscriber_id_fkey FOREIGN KEY (subscriber_id) REFERENCES public.subscribers(id) ON DELETE CASCADE;


--
-- Name: comments Comments are viewable by everyone; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Comments are viewable by everyone" ON public.comments FOR SELECT USING (true);


--
-- Name: loopnet_listings Enable read access for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable read access for all users" ON public.loopnet_listings FOR SELECT USING (true);


--
-- Name: event_invites Event owners can insert event invites; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Event owners can insert event invites" ON public.event_invites FOR INSERT WITH CHECK (((EXISTS ( SELECT 1
   FROM public.events e
  WHERE ((e.id = event_invites.event_id) AND (e.user_id = auth.uid())))) AND (auth.uid() = user_id)));


--
-- Name: event_invites Event owners can view event invites; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Event owners can view event invites" ON public.event_invites FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.events e
  WHERE ((e.id = event_invites.event_id) AND (e.user_id = auth.uid())))));


--
-- Name: events Everyone can view all events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Everyone can view all events" ON public.events FOR SELECT USING (true);


--
-- Name: likes Likes are viewable by everyone; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Likes are viewable by everyone" ON public.likes FOR SELECT USING (true);


--
-- Name: posts Posts are viewable by everyone; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Posts are viewable by everyone" ON public.posts FOR SELECT USING (true);


--
-- Name: profiles Public profiles are viewable by everyone.; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public profiles are viewable by everyone." ON public.profiles FOR SELECT USING (true);


--
-- Name: notifications System can insert notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "System can insert notifications" ON public.notifications FOR INSERT WITH CHECK (true);


--
-- Name: event_blasts Users can create blasts for their events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create blasts for their events" ON public.event_blasts FOR INSERT WITH CHECK (((EXISTS ( SELECT 1
   FROM public.events
  WHERE ((events.id = event_blasts.event_id) AND (events.user_id = auth.uid())))) AND (user_id = auth.uid())));


--
-- Name: events Users can create own events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create own events" ON public.events FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: events Users can delete own events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own events" ON public.events FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: people_board_assignments Users can delete their own board assignments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own board assignments" ON public.people_board_assignments FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: comments Users can delete their own comments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own comments" ON public.comments FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: events Users can delete their own events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own events" ON public.events FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: groups Users can delete their own groups; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own groups" ON public.groups FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: integrations Users can delete their own integrations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own integrations" ON public.integrations FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: interactions Users can delete their own interactions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own interactions" ON public.interactions FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: likes Users can delete their own likes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own likes" ON public.likes FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: people Users can delete their own people; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own people" ON public.people FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: posts Users can delete their own posts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own posts" ON public.posts FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: people_relationships Users can delete their own relationships; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own relationships" ON public.people_relationships FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: people_groups Users can delete their people_groups; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their people_groups" ON public.people_groups FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.people
  WHERE ((people.id = people_groups.person_id) AND (people.user_id = auth.uid())))));


--
-- Name: people_board_assignments Users can insert their own board assignments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own board assignments" ON public.people_board_assignments FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: comments Users can insert their own comments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own comments" ON public.comments FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: events Users can insert their own events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own events" ON public.events FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: groups Users can insert their own groups; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own groups" ON public.groups FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: integrations Users can insert their own integrations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own integrations" ON public.integrations FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: interactions Users can insert their own interactions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own interactions" ON public.interactions FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: kanban_columns Users can insert their own kanban columns; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own kanban columns" ON public.kanban_columns FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: likes Users can insert their own likes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own likes" ON public.likes FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: people Users can insert their own people; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own people" ON public.people FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: posts Users can insert their own posts or admins can insert for other; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own posts or admins can insert for other" ON public.posts FOR INSERT WITH CHECK (((auth.uid() = user_id) OR (EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.is_admin = true))))));


--
-- Name: profiles Users can insert their own profile.; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own profile." ON public.profiles FOR INSERT WITH CHECK ((auth.uid() = id));


--
-- Name: people_relationships Users can insert their own relationships; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own relationships" ON public.people_relationships FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: people_groups Users can insert their people_groups; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their people_groups" ON public.people_groups FOR INSERT WITH CHECK (((EXISTS ( SELECT 1
   FROM public.people
  WHERE ((people.id = people_groups.person_id) AND (people.user_id = auth.uid())))) AND (EXISTS ( SELECT 1
   FROM public.groups
  WHERE ((groups.id = people_groups.group_id) AND (groups.user_id = auth.uid()))))));


--
-- Name: notifications Users can mark their notifications as read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can mark their notifications as read" ON public.notifications FOR UPDATE USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: messages Users can mark their received messages as read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can mark their received messages as read" ON public.messages FOR UPDATE USING ((auth.uid() = recipient_id)) WITH CHECK ((auth.uid() = recipient_id));


--
-- Name: event_registrations Users can register for events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can register for events" ON public.event_registrations FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: messages Users can send messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can send messages" ON public.messages FOR INSERT WITH CHECK ((auth.uid() = sender_id));


--
-- Name: event_registrations Users can unregister from events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can unregister from events" ON public.event_registrations FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: events Users can update own events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own events" ON public.events FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: profiles Users can update own profile.; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own profile." ON public.profiles FOR UPDATE USING ((auth.uid() = id));


--
-- Name: people_board_assignments Users can update their own board assignments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own board assignments" ON public.people_board_assignments FOR UPDATE USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: comments Users can update their own comments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own comments" ON public.comments FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: events Users can update their own events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own events" ON public.events FOR UPDATE USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: groups Users can update their own groups; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own groups" ON public.groups FOR UPDATE USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: integrations Users can update their own integrations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own integrations" ON public.integrations FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: interactions Users can update their own interactions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own interactions" ON public.interactions FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: kanban_columns Users can update their own kanban columns; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own kanban columns" ON public.kanban_columns FOR UPDATE USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: people Users can update their own people; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own people" ON public.people FOR UPDATE USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: posts Users can update their own posts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own posts" ON public.posts FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: event_blasts Users can view blasts for their events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view blasts for their events" ON public.event_blasts FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.events
  WHERE ((events.id = event_blasts.event_id) AND (events.user_id = auth.uid())))));


--
-- Name: event_registrations Users can view event registrations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view event registrations" ON public.event_registrations FOR SELECT USING (((auth.uid() = user_id) OR (auth.uid() IN ( SELECT events.user_id
   FROM public.events
  WHERE (events.id = event_registrations.event_id)))));


--
-- Name: events Users can view own events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own events" ON public.events FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: people_board_assignments Users can view their own board assignments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own board assignments" ON public.people_board_assignments FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: groups Users can view their own groups; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own groups" ON public.groups FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: integrations Users can view their own integrations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own integrations" ON public.integrations FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: interactions Users can view their own interactions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own interactions" ON public.interactions FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: kanban_columns Users can view their own kanban columns; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own kanban columns" ON public.kanban_columns FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: messages Users can view their own messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own messages" ON public.messages FOR SELECT USING (((auth.uid() = sender_id) OR (auth.uid() = recipient_id)));


--
-- Name: notifications Users can view their own notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own notifications" ON public.notifications FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: people Users can view their own people; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own people" ON public.people FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: people_relationships Users can view their own relationships; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own relationships" ON public.people_relationships FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: people_groups Users can view their people_groups; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their people_groups" ON public.people_groups FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.people
  WHERE ((people.id = people_groups.person_id) AND (people.user_id = auth.uid())))));


--
-- Name: comments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

--
-- Name: event_blasts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.event_blasts ENABLE ROW LEVEL SECURITY;

--
-- Name: event_invites; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.event_invites ENABLE ROW LEVEL SECURITY;

--
-- Name: event_registrations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.event_registrations ENABLE ROW LEVEL SECURITY;

--
-- Name: events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

--
-- Name: groups; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;

--
-- Name: integrations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.integrations ENABLE ROW LEVEL SECURITY;

--
-- Name: interactions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.interactions ENABLE ROW LEVEL SECURITY;

--
-- Name: kanban_columns; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.kanban_columns ENABLE ROW LEVEL SECURITY;

--
-- Name: likes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;

--
-- Name: messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

--
-- Name: notifications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

--
-- Name: people; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.people ENABLE ROW LEVEL SECURITY;

--
-- Name: people_board_assignments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.people_board_assignments ENABLE ROW LEVEL SECURITY;

--
-- Name: people_groups; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.people_groups ENABLE ROW LEVEL SECURITY;

--
-- Name: people_relationships; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.people_relationships ENABLE ROW LEVEL SECURITY;

--
-- Name: posts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--

\unrestrict abbvUSExRwmAxi9RbJxKoJypArnchyTyijZXbotFaHq291Kpuyg6VAeyUfhWSf2

