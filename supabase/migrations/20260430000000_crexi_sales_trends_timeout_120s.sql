-- Raise statement_timeout on Crexi spatial sales trends RPCs to 120s.
--
-- The 286k-row backfill from OPE-219 added 11 new dense columns to
-- crexi_api_comps. Spatial scans (county, neighborhood, MSA) now need
-- more headroom in CI. 120s gives a 2× margin over the observed ~50s
-- worst-case after VACUUM ANALYZE.

ALTER FUNCTION public.get_crexi_sales_trends_by_city(text, text)
    SET statement_timeout = '120s';

ALTER FUNCTION public.get_crexi_sales_trends_by_county(text, text)
    SET statement_timeout = '120s';

ALTER FUNCTION public.get_crexi_sales_trends_by_neighborhood(integer[])
    SET statement_timeout = '120s';

ALTER FUNCTION public.get_crexi_sales_trends_by_msa(text)
    SET statement_timeout = '120s';
