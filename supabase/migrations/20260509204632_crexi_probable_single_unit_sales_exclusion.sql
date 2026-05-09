-- Exclude probable single-unit sale records that carry whole-building unit counts.
--
-- Signal:
--   * reported unit count is large enough to be a building-level count
--   * sale price per reported unit is implausibly low
--   * parcel/footprint/building area per reported unit is physically implausible
--   * address_count does not corroborate the reported unit count

CREATE OR REPLACE FUNCTION public.backfill_crexi_probable_single_unit_sales_trends_exclusions(
    p_start_id bigint,
    p_end_id_exclusive bigint
)
RETURNS TABLE(updated_count integer)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
    WITH probable_single_unit_sales AS (
        SELECT c.id
        FROM public.crexi_api_comps c
        WHERE c.id >= p_start_id
          AND c.id < p_end_id_exclusive
          AND c.is_sales_comp IS TRUE
          AND c.exclude_from_sales_trends = false
          AND c.property_price_total IS NOT NULL
          AND c.property_price_total > 0
          AND c.num_units IS NOT NULL
          AND c.num_units >= 10
          AND c.property_price_total / c.num_units::double precision < 100000
          AND (c.address_count IS NULL OR c.address_count < c.num_units)
          AND (
              (c.lot_size_sqft IS NOT NULL AND c.lot_size_sqft > 0 AND c.lot_size_sqft / c.num_units::double precision < 150)
              OR (c.footprint_sqft IS NOT NULL AND c.footprint_sqft > 0 AND c.footprint_sqft / c.num_units::double precision < 100)
              OR (c.building_sqft IS NOT NULL AND c.building_sqft > 0 AND c.building_sqft / c.num_units::double precision < 250)
          )
    ),
    updated AS (
        UPDATE public.crexi_api_comps c
        SET exclude_from_sales_trends = true,
            sales_trends_exclusion_reason = 'probable_single_unit_sale_building_units'
        FROM probable_single_unit_sales p
        WHERE c.id = p.id
        RETURNING c.id
    )
    SELECT count(*)::integer AS updated_count
    FROM updated;
$$;
