-- Move Crexi search-index payload (raw_json) and property-detail payload (detail_json)
-- off the hot crexi_api_comps heap into one-row-per-crexi_id side tables. Keeps
-- sales-trends GiST scans and sequential heap reads smaller.
--
-- The supabase db push migrations role has a 2-minute statement_timeout. Backfilling
-- ~300k JSONB rows into the side tables (statements 2 and 3) exceeds that budget,
-- so we disable the timeout here.
--
-- IMPORTANT: use plain `SET` (session-scoped), not `SET LOCAL`. `supabase db push`
-- does not wrap each migration file in an explicit transaction — it executes
-- statements in autocommit mode — so `SET LOCAL` is silently dropped with a
-- `WARNING (25P01): SET LOCAL can only be used in transaction blocks` and the
-- role-level 2-min timeout stays in effect. Session-level `SET` persists across
-- the autocommit statements on the same connection and reliably disables the
-- timeout for the rest of this migration. `work_mem` is also bumped so the bulk
-- inserts stay in memory.
SET statement_timeout = 0;
SET work_mem = '256MB';

-- If a prior apply failed after registering composite row types but before the
-- heap relation existed, Postgres can leave an orphaned `pg_type` row. A later
-- `CREATE TABLE IF NOT EXISTS` then errors with:
--   duplicate key value violates unique constraint "pg_type_typname_nsp_index"
-- Repair by dropping the orphan type when no table exists (safe no-op otherwise).
DO $$
BEGIN
    IF to_regclass('public.crexi_api_comp_raw_json') IS NULL THEN
        DROP TYPE IF EXISTS public.crexi_api_comp_raw_json CASCADE;
    END IF;
    IF to_regclass('public.crexi_api_comp_detail_json') IS NULL THEN
        DROP TYPE IF EXISTS public.crexi_api_comp_detail_json CASCADE;
    END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.crexi_api_comp_raw_json (
    crexi_id text PRIMARY KEY REFERENCES public.crexi_api_comps (crexi_id) ON DELETE CASCADE,
    raw_json jsonb NOT NULL,
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.crexi_api_comp_detail_json (
    crexi_id text PRIMARY KEY REFERENCES public.crexi_api_comps (crexi_id) ON DELETE CASCADE,
    detail_json jsonb,
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

INSERT INTO public.crexi_api_comp_raw_json (crexi_id, raw_json)
SELECT c.crexi_id, c.raw_json
FROM public.crexi_api_comps c
WHERE c.crexi_id IS NOT NULL
  AND c.raw_json IS NOT NULL
ON CONFLICT (crexi_id) DO UPDATE SET
    raw_json = EXCLUDED.raw_json,
    updated_at = now();

INSERT INTO public.crexi_api_comp_detail_json (crexi_id, detail_json, updated_at)
SELECT c.crexi_id, c.detail_json, coalesce(c.detail_enriched_at, now())
FROM public.crexi_api_comps c
WHERE c.crexi_id IS NOT NULL
  AND (c.detail_json IS NOT NULL OR c.detail_enriched_at IS NOT NULL)
ON CONFLICT (crexi_id) DO UPDATE SET
    detail_json = EXCLUDED.detail_json,
    updated_at = EXCLUDED.updated_at;

-- Re-apply per-unit exclusion using the moved payload (idempotent).
UPDATE public.crexi_api_comps c
SET exclude_from_sales_trends = true
WHERE EXISTS (
    SELECT 1
    FROM public.crexi_api_comp_raw_json r
    WHERE r.crexi_id = c.crexi_id
      AND r.raw_json -> 'address' -> 0 ->> 'unitNumber' IS NOT NULL
);

ALTER TABLE public.crexi_api_comps
    DROP COLUMN IF EXISTS raw_json,
    DROP COLUMN IF EXISTS detail_json;
