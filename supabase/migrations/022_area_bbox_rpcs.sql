-- Bounding-box RPCs for the listing map's area-type search.
-- Returns ST_Envelope extents so the UI can call map.fitBounds() when the
-- user selects a neighborhood or MSA from the autocomplete.

CREATE OR REPLACE FUNCTION public.get_neighborhood_bbox(p_neighborhood_id integer)
RETURNS TABLE(west float8, south float8, east float8, north float8)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    ST_XMin(ST_Envelope(geom))::float8 AS west,
    ST_YMin(ST_Envelope(geom))::float8 AS south,
    ST_XMax(ST_Envelope(geom))::float8 AS east,
    ST_YMax(ST_Envelope(geom))::float8 AS north
  FROM neighborhoods
  WHERE id = p_neighborhood_id;
$$;

CREATE OR REPLACE FUNCTION public.get_msa_bbox(p_geoid text)
RETURNS TABLE(west float8, south float8, east float8, north float8)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    ST_XMin(ST_Envelope(geom))::float8 AS west,
    ST_YMin(ST_Envelope(geom))::float8 AS south,
    ST_XMax(ST_Envelope(geom))::float8 AS east,
    ST_YMax(ST_Envelope(geom))::float8 AS north
  FROM msa_boundaries
  WHERE geoid = p_geoid;
$$;

GRANT EXECUTE ON FUNCTION public.get_neighborhood_bbox(integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_msa_bbox(text) TO anon, authenticated;
