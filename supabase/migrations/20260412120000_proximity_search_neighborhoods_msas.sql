-- Add optional proximity bias to search_neighborhoods and search_msas.
-- When p_lat / p_lng are supplied, results within the same name-match tier are
-- sorted by distance to the reference point (nearest first).  When omitted the
-- functions behave exactly as before.
--
-- Drop old single-argument overloads so there is no ambiguity when the caller
-- passes only p_query (the new function uses DEFAULT NULLs for the new params).
DROP FUNCTION IF EXISTS public.search_neighborhoods(text);
DROP FUNCTION IF EXISTS public.search_msas(text);

CREATE OR REPLACE FUNCTION public.search_neighborhoods(
    p_query text,
    p_lat  double precision DEFAULT NULL,
    p_lng  double precision DEFAULT NULL
)
RETURNS TABLE(id integer, name character varying, city character varying, state character varying)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  WITH normalized AS (
    SELECT regexp_replace(trim(p_query), '[,\s]+', ' ', 'g') AS q
  )
  SELECT n.id, n.name, n.city, n.state
  FROM public.neighborhoods n
  CROSS JOIN normalized
  WHERE (n.name || ' ' || n.city || ' ' || n.state) ILIKE '%' || normalized.q || '%'
  ORDER BY
    CASE WHEN n.name ILIKE '%' || normalized.q || '%' THEN 0 ELSE 1 END,
    CASE
      WHEN p_lat IS NOT NULL AND p_lng IS NOT NULL
        THEN ST_Distance(
               ST_Centroid(n.geom)::geography,
               ST_MakePoint(p_lng, p_lat)::geography
             )
      ELSE 0
    END,
    n.name
  LIMIT 8;
$$;

CREATE OR REPLACE FUNCTION public.search_msas(
    p_query text,
    p_lat  double precision DEFAULT NULL,
    p_lng  double precision DEFAULT NULL
)
RETURNS TABLE(id bigint, name text, name_lsad text, geoid text)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  WITH normalized AS (
    SELECT regexp_replace(trim(p_query), '[,\s]+', ' ', 'g') AS q
  )
  SELECT m.id, m.name, m.name_lsad, m.geoid
  FROM public.msa_boundaries m
  CROSS JOIN normalized
  WHERE (m.name || ' ' || m.name_lsad) ILIKE '%' || normalized.q || '%'
  ORDER BY
    CASE WHEN m.name ILIKE '%' || normalized.q || '%' THEN 0 ELSE 1 END,
    CASE
      WHEN p_lat IS NOT NULL AND p_lng IS NOT NULL
        THEN ST_Distance(
               ST_Centroid(m.geom)::geography,
               ST_MakePoint(p_lng, p_lat)::geography
             )
      ELSE 0
    END,
    m.name
  LIMIT 8;
$$;
