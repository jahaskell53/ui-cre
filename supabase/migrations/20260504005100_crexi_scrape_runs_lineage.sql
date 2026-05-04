-- OPE-237 (PR A of OPE-235): wire run lineage onto Crexi bronze (raw_json/detail_json)
-- side tables, expose `_latest` views for ETL convenience, and stop cascading bronze
-- deletes from `crexi_api_comps`. Strictly additive — primary keys still `(crexi_id)`,
-- so re-scrapes still upsert today. PR B (OPE-238) flips the PK to `(crexi_id, run_id)`
-- and adds the append-only trigger; both must land together because an append-only
-- trigger is incompatible with a `crexi_id`-only primary key under upsert semantics.
--
-- NOTE: The backfill that populates run_id/fetched_at on existing bronze rows is
-- intentionally NOT here. It runs as a one-shot Dagster job
-- (backfill_crexi_run_lineage_job) so it can page through ~576k rows without
-- hitting the 2-minute statement_timeout on the migrations role.

-- 1. Lineage table -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.crexi_scrape_runs (
    run_id          bigserial PRIMARY KEY,
    -- 'search' = universal-search dump, 'detail' = per-property GET,
    -- 'legacy-import' = the one-time backfill row created below.
    source          text NOT NULL,
    scraper_version text,
    started_at      timestamptz NOT NULL DEFAULT now(),
    finished_at     timestamptz,
    status          text NOT NULL DEFAULT 'running',
    params          jsonb,
    row_count       integer,
    notes           text,
    CONSTRAINT crexi_scrape_runs_source_chk
        CHECK (source IN ('search', 'detail', 'legacy-import')),
    CONSTRAINT crexi_scrape_runs_status_chk
        CHECK (status IN ('running', 'completed', 'failed'))
);

CREATE INDEX IF NOT EXISTS idx_crexi_scrape_runs_source_started_at
    ON public.crexi_scrape_runs (source, started_at DESC);

-- 2. Add lineage + capture-time columns to bronze ----------------------------
ALTER TABLE public.crexi_api_comp_raw_json
    ADD COLUMN IF NOT EXISTS run_id     bigint REFERENCES public.crexi_scrape_runs(run_id),
    ADD COLUMN IF NOT EXISTS fetched_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.crexi_api_comp_detail_json
    ADD COLUMN IF NOT EXISTS run_id      bigint REFERENCES public.crexi_scrape_runs(run_id),
    ADD COLUMN IF NOT EXISTS fetched_at  timestamptz NOT NULL DEFAULT now(),
    ADD COLUMN IF NOT EXISTS http_status integer;

CREATE INDEX IF NOT EXISTS idx_crexi_api_comp_raw_json_run_id
    ON public.crexi_api_comp_raw_json (run_id);
CREATE INDEX IF NOT EXISTS idx_crexi_api_comp_raw_json_fetched_at
    ON public.crexi_api_comp_raw_json (fetched_at DESC);

CREATE INDEX IF NOT EXISTS idx_crexi_api_comp_detail_json_run_id
    ON public.crexi_api_comp_detail_json (run_id);
CREATE INDEX IF NOT EXISTS idx_crexi_api_comp_detail_json_fetched_at
    ON public.crexi_api_comp_detail_json (fetched_at DESC);

-- 3. `_latest` views — single source of truth for downstream silver builds ---
-- Today bronze still has one row per crexi_id, so these views are 1:1 with
-- the underlying tables. Once PR B lands and bronze becomes append-only with
-- multiple rows per crexi_id, these views still expose the freshest payload.
CREATE OR REPLACE VIEW public.crexi_api_comp_raw_json_latest AS
SELECT DISTINCT ON (crexi_id)
    crexi_id,
    raw_json,
    run_id,
    fetched_at,
    updated_at
FROM public.crexi_api_comp_raw_json
ORDER BY crexi_id, fetched_at DESC, updated_at DESC;

CREATE OR REPLACE VIEW public.crexi_api_comp_detail_json_latest AS
SELECT DISTINCT ON (crexi_id)
    crexi_id,
    detail_json,
    http_status,
    run_id,
    fetched_at,
    updated_at
FROM public.crexi_api_comp_detail_json
ORDER BY crexi_id, fetched_at DESC, updated_at DESC;

-- 4. Drop the cascade — bronze must outlive silver --------------------------
ALTER TABLE public.crexi_api_comp_raw_json
    DROP CONSTRAINT IF EXISTS crexi_api_comp_raw_json_crexi_id_fkey;
ALTER TABLE public.crexi_api_comp_raw_json
    ADD CONSTRAINT crexi_api_comp_raw_json_crexi_id_fkey
        FOREIGN KEY (crexi_id) REFERENCES public.crexi_api_comps (crexi_id);

ALTER TABLE public.crexi_api_comp_detail_json
    DROP CONSTRAINT IF EXISTS crexi_api_comp_detail_json_crexi_id_fkey;
ALTER TABLE public.crexi_api_comp_detail_json
    ADD CONSTRAINT crexi_api_comp_detail_json_crexi_id_fkey
        FOREIGN KEY (crexi_id) REFERENCES public.crexi_api_comps (crexi_id);

-- Note: append-only enforcement (UPDATE/DELETE-rejecting trigger) intentionally
-- ships in PR B (OPE-238) alongside the `(crexi_id, run_id)` primary key swap.
-- Adding it here would break the existing upsert scrape path.
