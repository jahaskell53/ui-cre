-- Restore crexi_api_comps.num_units from universal-search payload
-- (propertyAttributes.unitsCount) instead of detail API numberOfUnits.
UPDATE public.crexi_api_comps c
SET num_units = (
    (r.raw_json -> 'propertyAttributes' ->> 'unitsCount')::integer
)
FROM public.crexi_api_comp_raw_json r
WHERE r.crexi_id = c.crexi_id
  AND r.raw_json ? 'propertyAttributes'
  AND r.raw_json -> 'propertyAttributes' ? 'unitsCount'
  AND (r.raw_json -> 'propertyAttributes' ->> 'unitsCount') ~ '^[0-9]+$';
