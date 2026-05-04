-- OPE-240: Partial indexes for Dagster backfill_crexi_run_lineage_job.
--
-- PostgREST pages with `WHERE run_id IS NULL ORDER BY crexi_id`. Without a
-- suitable index Postgres scans the whole bronze table (~290k+ rows) and can
-- hit statement_timeout before returning the first page.

CREATE INDEX IF NOT EXISTS idx_crexi_api_comp_raw_json_run_id_null_crexi
    ON public.crexi_api_comp_raw_json (crexi_id)
    WHERE run_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_crexi_api_comp_detail_json_run_id_null_crexi
    ON public.crexi_api_comp_detail_json (crexi_id)
    WHERE run_id IS NULL;
