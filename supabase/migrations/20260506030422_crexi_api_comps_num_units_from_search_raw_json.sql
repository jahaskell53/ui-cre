-- Restore crexi_api_comps.num_units from universal-search payload
-- (propertyAttributes.unitsCount) instead of detail API numberOfUnits.
--
-- The supabase db push migrations role has a 2-minute statement_timeout. This
-- UPDATE joins every comp row to JSONB in crexi_api_comp_raw_json and can exceed
-- that budget on production. Use session-scoped SET (not SET LOCAL): db push runs
-- statements in autocommit mode, so SET LOCAL is dropped and the role timeout
-- would still apply. See 20260503234944_crexi_api_comps_split_json_tables.sql.
SET statement_timeout = 0;
SET work_mem = '256MB';

UPDATE public.crexi_api_comps c
SET num_units = (
    (r.raw_json -> 'propertyAttributes' ->> 'unitsCount')::integer
)
FROM public.crexi_api_comp_raw_json r
WHERE r.crexi_id = c.crexi_id
  AND r.raw_json ? 'propertyAttributes'
  AND r.raw_json -> 'propertyAttributes' ? 'unitsCount'
  AND (r.raw_json -> 'propertyAttributes' ->> 'unitsCount') ~ '^[0-9]+$';
