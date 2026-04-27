-- Set statement_timeout on Crexi sales trends RPCs.
--
-- The spatial variants (county, neighborhood, MSA) join crexi_api_comps
-- against large boundary polygons. Without an explicit timeout the functions
-- inherit the session default which can be very short in the integration test
-- environment, causing 57014 errors. 30s matches the limit used by all other
-- spatial RPCs in this codebase.

ALTER FUNCTION public.get_crexi_sales_trends(text)
    SET statement_timeout = '30s';

ALTER FUNCTION public.get_crexi_sales_trends_by_city(text, text)
    SET statement_timeout = '30s';

ALTER FUNCTION public.get_crexi_sales_trends_by_county(text, text)
    SET statement_timeout = '30s';

ALTER FUNCTION public.get_crexi_sales_trends_by_neighborhood(integer[])
    SET statement_timeout = '30s';

ALTER FUNCTION public.get_crexi_sales_trends_by_msa(text)
    SET statement_timeout = '30s';
