-- GeoJSON boundary RPCs for the listing map area overlay (task 054).
-- Each function returns ST_AsGeoJSON text (raw geometry, not a Feature wrapper)
-- with light topology-preserving simplification to keep payloads small.

CREATE OR REPLACE FUNCTION public.get_neighborhood_geojson(p_id integer)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT ST_AsGeoJSON(ST_SimplifyPreserveTopology(geom, 0.0001))::text
  FROM neighborhoods
  WHERE id = p_id
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_county_geojson(p_name text, p_state text)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT ST_AsGeoJSON(ST_SimplifyPreserveTopology(geom, 0.0001))::text
  FROM county_boundaries
  WHERE name_lsad ILIKE p_name
    AND state = p_state
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_msa_geojson(p_geoid text)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT ST_AsGeoJSON(ST_SimplifyPreserveTopology(geom, 0.0001))::text
  FROM msa_boundaries
  WHERE geoid = p_geoid
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_city_geojson(p_name text, p_state text)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT ST_AsGeoJSON(ST_SimplifyPreserveTopology(geom, 0.0001))::text
  FROM city_boundaries
  WHERE name ILIKE p_name
    AND state ILIKE p_state
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_neighborhood_geojson(integer)   TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_county_geojson(text, text)       TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_msa_geojson(text)                TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_city_geojson(text, text)         TO anon, authenticated;
