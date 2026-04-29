-- Add cap_rate_source and detail_fetched_at to crexi_api_comps.
--
-- cap_rate_source tracks where a cap rate value came from when it is not
-- present in the bulk search API response.  Current values:
--   'api_detail'  — fetched from the Crexi property detail endpoint
--
-- detail_fetched_at records when the Crexi detail endpoint was last called
-- for a given row, used for idempotency in the backfill job.

ALTER TABLE public.crexi_api_comps
    ADD COLUMN IF NOT EXISTS cap_rate_source text,
    ADD COLUMN IF NOT EXISTS detail_fetched_at timestamp with time zone;
