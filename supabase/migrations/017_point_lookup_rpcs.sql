-- Spatial point-in-polygon lookups for resolving an address (lat/lng) to a
-- neighborhood or MSA. Used by the address granularity picker on the trends page.

CREATE OR REPLACE FUNCTION public.get_neighborhood_at_point(p_lat float8, p_lng float8)
RETURNS TABLE(id integer, name varchar, city varchar, state varchar)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT id, name, city, state
  FROM neighborhoods
  WHERE ST_Within(ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326), geom)
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_msa_at_point(p_lat float8, p_lng float8)
RETURNS TABLE(id bigint, name text, name_lsad text, geoid text)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT id, name, name_lsad, geoid
  FROM msa_boundaries
  WHERE ST_Within(ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326), geom)
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_neighborhood_at_point(float8, float8) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_msa_at_point(float8, float8) TO anon, authenticated;
