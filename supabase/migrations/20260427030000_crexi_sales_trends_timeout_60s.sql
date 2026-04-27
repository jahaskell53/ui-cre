-- Raise statement_timeout on Crexi spatial sales trends RPCs to 60s.
--
-- The SF Bay Area MSA query scans ~142k matching rows (~25s on current hardware).
-- 30s was too close to the wire in CI. 60s gives a comfortable margin.

ALTER FUNCTION public.get_crexi_sales_trends_by_county(text, text)
    SET statement_timeout = '60s';

ALTER FUNCTION public.get_crexi_sales_trends_by_neighborhood(integer[])
    SET statement_timeout = '60s';

ALTER FUNCTION public.get_crexi_sales_trends_by_msa(text)
    SET statement_timeout = '60s';
