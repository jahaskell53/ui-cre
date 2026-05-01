-- Reduce CI variance on Crexi spatial sales-trends RPCs.
--
-- After ST_Covers (#227) and the 120s function-level statement_timeout, the
-- only remaining failure mode in CI was the SF Bay Area cold-cache path:
-- `get_crexi_sales_trends_by_county('Alameda County','CA')` and
-- `get_crexi_sales_trends_by_msa('41860')` could blow past the integration
-- harness 120s cap when the buffer cache for crexi_api_comps_geom_idx and
-- the underlying heap had not been warmed yet.
--
-- Two changes here:
--
-- 1) Per-function `SET work_mem = '64MB'`. Default work_mem on this Supabase
--    project is ~2MB, so the per-month PERCENTILE_CONT sort spilled to disk
--    on the SF Bay Area path (139k candidate points → external merge).
--    Bumping work_mem keeps the sort in memory.
--
-- 2) Partial GiST index `crexi_api_comps_sales_trends_geom_idx` matching the
--    sales-trends filter. Today the join uses `crexi_api_comps_geom_idx`,
--    which covers all 286k rows; only ~165k of those are eligible (58%).
--    Restricting the index to eligible rows shrinks both the index footprint
--    and the post-bbox heap fetches, which is what dominates cold-cache
--    runtime (~250k shared buffers per call).

CREATE INDEX IF NOT EXISTS crexi_api_comps_sales_trends_geom_idx
    ON public.crexi_api_comps
    USING gist (geom)
    WHERE is_sales_comp = true
      AND NOT exclude_from_sales_trends
      AND property_price_total IS NOT NULL
      AND property_price_total > 0
      AND num_units IS NOT NULL
      AND num_units > 0
      AND sale_transaction_date IS NOT NULL
      AND geom IS NOT NULL;

ALTER FUNCTION public.get_crexi_sales_trends(text)
    SET work_mem = '64MB';

ALTER FUNCTION public.get_crexi_sales_trends_by_city(text, text)
    SET work_mem = '64MB';

ALTER FUNCTION public.get_crexi_sales_trends_by_county(text, text)
    SET work_mem = '64MB';

ALTER FUNCTION public.get_crexi_sales_trends_by_neighborhood(integer[])
    SET work_mem = '64MB';

ALTER FUNCTION public.get_crexi_sales_trends_by_msa(text)
    SET work_mem = '64MB';
