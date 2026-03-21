CREATE OR REPLACE FUNCTION public.get_adjacent_neighborhoods_batch(p_ids integer[])
 RETURNS TABLE(id integer, name character varying, city character varying, geojson text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
  SELECT DISTINCT ON (n.id) n.id, n.name, n.city, ST_AsGeoJSON(n.geom)::text AS geojson
  FROM neighborhoods n
  WHERE EXISTS (
    SELECT 1 FROM neighborhoods s
    WHERE s.id = ANY(p_ids)
      AND ST_DWithin(n.geom, s.geom, 0.001)
  )
  AND n.id != ALL(p_ids)
  ORDER BY n.id;
$function$
