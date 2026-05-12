-- OPE-238 (PR B of OPE-235): switch Crexi bronze tables from one row per
-- crexi_id to append-only history keyed by (crexi_id, run_id).

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM public.crexi_api_comp_raw_json
        WHERE run_id IS NULL OR fetched_at IS NULL
    ) THEN
        RAISE EXCEPTION
            'crexi_api_comp_raw_json still has NULL run_id or fetched_at rows';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.crexi_api_comp_detail_json
        WHERE run_id IS NULL OR fetched_at IS NULL
    ) THEN
        RAISE EXCEPTION
            'crexi_api_comp_detail_json still has NULL run_id or fetched_at rows';
    END IF;
END;
$$;

ALTER TABLE public.crexi_api_comp_raw_json
    ALTER COLUMN run_id SET NOT NULL,
    ALTER COLUMN fetched_at SET NOT NULL;

ALTER TABLE public.crexi_api_comp_detail_json
    ALTER COLUMN run_id SET NOT NULL,
    ALTER COLUMN fetched_at SET NOT NULL;

ALTER TABLE public.crexi_api_comp_raw_json
    DROP CONSTRAINT IF EXISTS crexi_api_comp_raw_json_pkey,
    ADD CONSTRAINT crexi_api_comp_raw_json_pkey PRIMARY KEY (crexi_id, run_id);

ALTER TABLE public.crexi_api_comp_detail_json
    DROP CONSTRAINT IF EXISTS crexi_api_comp_detail_json_pkey,
    ADD CONSTRAINT crexi_api_comp_detail_json_pkey PRIMARY KEY (crexi_id, run_id);

CREATE INDEX IF NOT EXISTS idx_crexi_api_comp_raw_json_crexi_fetched_at
    ON public.crexi_api_comp_raw_json (crexi_id, fetched_at DESC);

CREATE INDEX IF NOT EXISTS idx_crexi_api_comp_detail_json_crexi_fetched_at
    ON public.crexi_api_comp_detail_json (crexi_id, fetched_at DESC);

CREATE INDEX IF NOT EXISTS idx_crexi_api_comp_raw_json_run_id
    ON public.crexi_api_comp_raw_json (run_id);

CREATE INDEX IF NOT EXISTS idx_crexi_api_comp_detail_json_run_id
    ON public.crexi_api_comp_detail_json (run_id);

DROP INDEX IF EXISTS public.idx_crexi_api_comp_raw_json_run_id_null_crexi;
DROP INDEX IF EXISTS public.idx_crexi_api_comp_detail_json_run_id_null_crexi;

CREATE OR REPLACE FUNCTION public.reject_crexi_bronze_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION '% is append-only; UPDATE and DELETE are not allowed', TG_TABLE_NAME
        USING ERRCODE = '55000';
END;
$$;

DROP TRIGGER IF EXISTS crexi_api_comp_raw_json_append_only
    ON public.crexi_api_comp_raw_json;

CREATE TRIGGER crexi_api_comp_raw_json_append_only
    BEFORE UPDATE OR DELETE ON public.crexi_api_comp_raw_json
    FOR EACH ROW
    EXECUTE FUNCTION public.reject_crexi_bronze_mutation();

DROP TRIGGER IF EXISTS crexi_api_comp_detail_json_append_only
    ON public.crexi_api_comp_detail_json;

CREATE TRIGGER crexi_api_comp_detail_json_append_only
    BEFORE UPDATE OR DELETE ON public.crexi_api_comp_detail_json
    FOR EACH ROW
    EXECUTE FUNCTION public.reject_crexi_bronze_mutation();
