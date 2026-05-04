-- OPE-240: Keyset fetch for Dagster crexi run lineage backfill.
--
-- PostgREST runs under a short statement_timeout. OFFSET paging on
-- WHERE run_id IS NULL ORDER BY crexi_id can still exceed that budget.
-- These STABLE SQL functions set statement_timeout = 120s for their body only
-- and return the next page using keyset (crexi_id > p_after_crexi_id).

CREATE OR REPLACE FUNCTION public.fetch_crexi_raw_lineage_backfill_page(
    p_after_crexi_id text,
    p_limit integer
)
RETURNS TABLE(crexi_id text, updated_at timestamptz)
LANGUAGE sql
STABLE
SET search_path = public
SET statement_timeout = '120s'
AS $$
    SELECT r.crexi_id, r.updated_at
    FROM public.crexi_api_comp_raw_json AS r
    WHERE r.run_id IS NULL
      AND (
          p_after_crexi_id IS NULL
          OR btrim(p_after_crexi_id) = ''
          OR r.crexi_id > p_after_crexi_id
      )
    ORDER BY r.crexi_id
    LIMIT greatest(1, least(coalesce(nullif(p_limit, 0), 500), 5000));
$$;

CREATE OR REPLACE FUNCTION public.fetch_crexi_detail_lineage_backfill_page(
    p_after_crexi_id text,
    p_limit integer
)
RETURNS TABLE(crexi_id text, updated_at timestamptz)
LANGUAGE sql
STABLE
SET search_path = public
SET statement_timeout = '120s'
AS $$
    SELECT d.crexi_id, d.updated_at
    FROM public.crexi_api_comp_detail_json AS d
    WHERE d.run_id IS NULL
      AND (
          p_after_crexi_id IS NULL
          OR btrim(p_after_crexi_id) = ''
          OR d.crexi_id > p_after_crexi_id
      )
    ORDER BY d.crexi_id
    LIMIT greatest(1, least(coalesce(nullif(p_limit, 0), 500), 5000));
$$;

GRANT EXECUTE ON FUNCTION public.fetch_crexi_raw_lineage_backfill_page(text, integer)
    TO service_role;

GRANT EXECUTE ON FUNCTION public.fetch_crexi_detail_lineage_backfill_page(text, integer)
    TO service_role;
