-- OPE-237 (PR A of OPE-235): wire run lineage onto Crexi bronze (raw_json/detail_json)
-- side tables, expose `_latest` views for ETL convenience, and stop cascading bronze
-- deletes from `crexi_api_comps`. Strictly additive — primary keys still `(crexi_id)`,
-- so re-scrapes still upsert today. PR B (OPE-238) flips the PK to `(crexi_id, run_id)`
-- and adds the append-only trigger; both must land together because an append-only
-- trigger is incompatible with a `crexi_id`-only primary key under upsert semantics.

SET LOCAL statement_timeout = 0;

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

-- 3. Backfill: one legacy-import run that owns every existing bronze row -----
-- Use the existing `updated_at` on each row as the historical capture time so
-- the `_latest` views below still pick the freshest payload.
WITH legacy_run AS (
    INSERT INTO public.crexi_scrape_runs (
        source, status, started_at, finished_at, row_count, notes
    )
    SELECT
        'legacy-import',
        'completed',
        coalesce(min(t.updated_at), now()),
        coalesce(max(t.updated_at), now()),
        (SELECT count(*) FROM public.crexi_api_comp_raw_json)
            + (SELECT count(*) FROM public.crexi_api_comp_detail_json),
        'Backfill row for OPE-237; owns every bronze row that pre-dates run_id.'
    FROM (
        SELECT updated_at FROM public.crexi_api_comp_raw_json
        UNION ALL
        SELECT updated_at FROM public.crexi_api_comp_detail_json
    ) t
    RETURNING run_id
)
UPDATE public.crexi_api_comp_raw_json r
SET run_id     = (SELECT run_id FROM legacy_run),
    fetched_at = r.updated_at
WHERE r.run_id IS NULL;

UPDATE public.crexi_api_comp_detail_json d
SET run_id     = (SELECT run_id FROM public.crexi_scrape_runs WHERE source = 'legacy-import' ORDER BY run_id DESC LIMIT 1),
    fetched_at = d.updated_at
WHERE d.run_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_crexi_api_comp_raw_json_run_id
    ON public.crexi_api_comp_raw_json (run_id);
CREATE INDEX IF NOT EXISTS idx_crexi_api_comp_raw_json_fetched_at
    ON public.crexi_api_comp_raw_json (fetched_at DESC);

CREATE INDEX IF NOT EXISTS idx_crexi_api_comp_detail_json_run_id
    ON public.crexi_api_comp_detail_json (run_id);
CREATE INDEX IF NOT EXISTS idx_crexi_api_comp_detail_json_fetched_at
    ON public.crexi_api_comp_detail_json (fetched_at DESC);

-- 4. `_latest` views — single source of truth for downstream silver builds ---
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

-- 5. Drop the cascade — bronze must outlive silver --------------------------
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
