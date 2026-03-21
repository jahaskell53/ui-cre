CREATE OR REPLACE FUNCTION public.get_zip_boundary(p_zip text)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
  SELECT ST_AsGeoJSON(geom)::text FROM zip_codes WHERE zip = p_zip LIMIT 1;
$function$
