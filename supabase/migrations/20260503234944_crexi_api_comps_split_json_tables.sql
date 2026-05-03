-- Move Crexi search-index payload (raw_json) and property-detail payload (detail_json)
-- off the hot crexi_api_comps heap into one-row-per-crexi_id side tables. Keeps
-- sales-trends GiST scans and sequential heap reads smaller.

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
