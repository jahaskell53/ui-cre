CREATE OR REPLACE FUNCTION public.get_expanded_neighborhood_geojson(p_id integer)
 RETURNS TABLE(geojson text, neighbor_count integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
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
$function$
