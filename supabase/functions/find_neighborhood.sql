CREATE OR REPLACE FUNCTION public.find_neighborhood(p_lng double precision, p_lat double precision)
 RETURNS TABLE(id integer, name character varying, city character varying, state character varying, geojson text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
  SELECT id, name, city, state, ST_AsGeoJSON(geom)::text AS geojson
  FROM neighborhoods
  WHERE ST_Within(ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326), geom)
  LIMIT 1;
$function$
