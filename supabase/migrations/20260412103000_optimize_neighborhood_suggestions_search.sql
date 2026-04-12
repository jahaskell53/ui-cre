-- Speed up neighborhood autocomplete by indexing the exact text expression
-- used by search_neighborhoods with pg_trgm.
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;

CREATE INDEX IF NOT EXISTS idx_neighborhoods_search_text_trgm
    ON public.neighborhoods
    USING gin (((name || ' ' || city || ' ' || state)::text) gin_trgm_ops);

CREATE OR REPLACE FUNCTION public.search_neighborhoods(p_query text)
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
    n.name
  LIMIT 8;
$$;
