-- Paginated listing of Crexi sales comps for a chart bucket (matches get_crexi_sales_trends_*_v2 filters
-- and aggregate-by-sample-window bucket semantics from the sales trends page).
-- Returns JSON: { "total": <bigint>, "rows": [ ... ] } so the client always gets a total for pagination.

CREATE OR REPLACE FUNCTION public.list_crexi_sales_comps_for_chart_bucket(
  p_bucket_month_start      date,
  p_sample_window_months    integer DEFAULT 1,
  p_zip                     text DEFAULT NULL,
  p_city                    text DEFAULT NULL,
  p_state                   text DEFAULT NULL,
  p_county_name             text DEFAULT NULL,
  p_county_state            text DEFAULT NULL,
  p_neighborhood_ids        integer[] DEFAULT NULL,
  p_msa_geoid               text DEFAULT NULL,
  p_min_units               integer DEFAULT NULL,
  p_max_units               integer DEFAULT NULL,
  p_sale_date_on_or_after  date DEFAULT NULL,
  p_limit                   integer DEFAULT 25,
  p_offset                  integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET statement_timeout = '120s'
AS $function$
WITH win AS (
  SELECT GREATEST(1, LEAST(p_sample_window_months, 12)) AS n
),
grp AS (
  SELECT
    floor(
      (EXTRACT(YEAR FROM p_bucket_month_start)::int * 12 + EXTRACT(MONTH FROM p_bucket_month_start)::int - 1)
      / (SELECT n FROM win)::numeric
    )::int * (SELECT n FROM win) AS bucket_group_mi
),
filtered AS (
  SELECT c.*
  FROM crexi_api_comps c
  WHERE
    c.is_sales_comp = true
    AND NOT c.exclude_from_sales_trends
    AND c.property_price_total IS NOT NULL AND c.property_price_total > 0
    AND c.num_units IS NOT NULL AND c.num_units > 0
    AND c.sale_transaction_date IS NOT NULL
    AND (p_min_units IS NULL OR c.num_units >= p_min_units)
    AND (p_max_units IS NULL OR c.num_units <= p_max_units)
    AND (p_sale_date_on_or_after IS NULL OR c.sale_transaction_date::date >= p_sale_date_on_or_after)
    AND floor(
      (EXTRACT(YEAR FROM c.sale_transaction_date::date)::int * 12 + EXTRACT(MONTH FROM c.sale_transaction_date::date)::int - 1)
      / (SELECT n FROM win)::numeric
    )::int * (SELECT n FROM win) = (SELECT bucket_group_mi FROM grp)
    AND (
      (p_zip IS NOT NULL AND c.zip = p_zip)
      OR (p_city IS NOT NULL AND p_state IS NOT NULL AND c.city ILIKE p_city AND c.state ILIKE p_state)
      OR (
        p_county_name IS NOT NULL AND p_county_state IS NOT NULL
        AND c.geom IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM county_boundaries cb
          WHERE cb.name_lsad ILIKE p_county_name
            AND cb.state = p_county_state
            AND cb.geom && c.geom
            AND ST_Within(c.geom, cb.geom)
        )
      )
      OR (
        p_neighborhood_ids IS NOT NULL AND cardinality(p_neighborhood_ids) > 0
        AND c.latitude IS NOT NULL AND c.longitude IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM neighborhoods n
          WHERE n.id = ANY(p_neighborhood_ids)
            AND ST_Within(ST_SetSRID(ST_Point(c.longitude, c.latitude), 4326), n.geom)
        )
      )
      OR (
        p_msa_geoid IS NOT NULL
        AND c.geom IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM msa_boundaries mb
          WHERE mb.geoid = p_msa_geoid
            AND mb.geom && c.geom
            AND ST_Within(c.geom, mb.geom)
        )
      )
    )
),
cnt AS (
  SELECT COUNT(*)::bigint AS n FROM filtered
),
page AS (
  SELECT
    f.id,
    f.crexi_url,
    f.property_name,
    f.address_full,
    f.city,
    f.state,
    f.zip,
    f.sale_transaction_date,
    f.property_price_total,
    f.num_units,
    (f.property_price_total / f.num_units::double precision) AS price_per_door,
    COALESCE(f.sale_cap_rate_percent, f.financials_cap_rate_percent) AS cap_rate_percent,
    ROW_NUMBER() OVER (ORDER BY f.sale_transaction_date::date DESC NULLS LAST, f.id DESC) AS rn
  FROM filtered f
)
SELECT jsonb_build_object(
  'total', (SELECT n FROM cnt),
  'rows', COALESCE(
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', p.id,
          'crexi_url', p.crexi_url,
          'property_name', p.property_name,
          'address_full', p.address_full,
          'city', p.city,
          'state', p.state,
          'zip', p.zip,
          'sale_transaction_date', p.sale_transaction_date,
          'property_price_total', p.property_price_total,
          'num_units', p.num_units,
          'price_per_door', p.price_per_door,
          'cap_rate_percent', p.cap_rate_percent
        )
        ORDER BY p.rn
      )
      FROM page p
      WHERE p.rn > p_offset AND p.rn <= p_offset + p_limit
    ),
    '[]'::jsonb
  )
);
$function$;
