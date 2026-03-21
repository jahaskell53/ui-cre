CREATE OR REPLACE FUNCTION public.get_adjacent_neighborhoods(p_id integer)
 RETURNS TABLE(id integer, name character varying, city character varying, geojson text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
  SELECT n.id, n.name, n.city, ST_AsGeoJSON(n.geom)::text
  FROM neighborhoods n, neighborhoods subject
  WHERE subject.id = p_id
    AND ST_DWithin(n.geom::geography, subject.geom::geography, 100);
$function$
