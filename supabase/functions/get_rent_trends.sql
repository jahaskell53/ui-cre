-- Overload 1: without p_reits_only
CREATE OR REPLACE FUNCTION public.get_rent_trends(p_zip text DEFAULT NULL::text, p_beds integer DEFAULT NULL::integer)
 RETURNS TABLE(week_start date, beds integer, median_rent numeric, listing_count bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
  SELECT
    DATE_TRUNC('week', scraped_at)::date AS week_start,
    CASE WHEN beds >= 3 THEN 3 ELSE beds END AS beds,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY price)::numeric AS median_rent,
    COUNT(*) AS listing_count
  FROM cleaned_listings
  WHERE
    price IS NOT NULL AND price > 500 AND price < 30000
    AND beds IS NOT NULL
    AND (p_zip IS NULL OR address_zip = p_zip)
    AND (p_beds IS NULL OR CASE WHEN beds >= 3 THEN 3 ELSE beds END = p_beds)
  GROUP BY 1, 2
  ORDER BY 1, 2;
$function$;

-- Overload 2: with p_reits_only
CREATE OR REPLACE FUNCTION public.get_rent_trends(p_zip text DEFAULT NULL::text, p_beds integer DEFAULT NULL::integer, p_reits_only boolean DEFAULT false)
 RETURNS TABLE(week_start date, beds integer, median_rent numeric, listing_count bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
  SELECT
    DATE_TRUNC('week', scraped_at)::date AS week_start,
    CASE WHEN beds IS NULL OR beds = 0 THEN 0 WHEN beds >= 3 THEN 3 ELSE beds END AS beds,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY price)::numeric AS median_rent,
    COUNT(*) AS listing_count
  FROM cleaned_listings
  WHERE
    price IS NOT NULL AND price > 500 AND price < 30000
    AND (p_zip IS NULL OR address_zip = p_zip)
    AND (p_beds IS NULL OR CASE WHEN beds IS NULL OR beds = 0 THEN 0 WHEN beds >= 3 THEN 3 ELSE beds END = p_beds)
    AND p_reits_only = (building_zpid IS NOT NULL)
  GROUP BY 1, 2
  ORDER BY 1, 2;
$function$
