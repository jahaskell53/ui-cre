-- Use Zillow address lookups as retryable source records and make exclusion reasons explicit.

ALTER TABLE public.crexi_api_comps
    ADD COLUMN IF NOT EXISTS sales_trends_exclusion_reason text;

ALTER TABLE public.crexi_zillow_condo_xrefs
    ADD COLUMN IF NOT EXISTS is_sales_trends_excluded boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS sales_trends_exclusion_reason text;

UPDATE public.crexi_zillow_condo_xrefs
SET is_sales_trends_excluded = true,
    sales_trends_exclusion_reason = 'zillow_home_type_condo'
WHERE is_condo = true
  AND sales_trends_exclusion_reason IS NULL;

CREATE OR REPLACE FUNCTION public.get_crexi_zillow_condo_scrape_candidates(
    p_start_id bigint,
    p_end_id_exclusive bigint,
    p_limit integer DEFAULT 1000
)
RETURNS TABLE(
    run_id text,
    crexi_comp_id bigint,
    crexi_id text,
    address_street text,
    city text,
    state text,
    zip text,
    query_address text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
    WITH scrape_run AS (
        SELECT gen_random_uuid()::text AS run_id
    )
    SELECT
        scrape_run.run_id,
        c.id AS crexi_comp_id,
        c.crexi_id,
        c.address_street,
        c.city,
        c.state,
        left(regexp_replace(coalesce(c.zip, ''), '[^0-9]', '', 'g'), 5) AS zip,
        concat_ws(
            ', ',
            nullif(btrim(c.address_street), ''),
            nullif(btrim(c.city), ''),
            nullif(btrim(c.state), ''),
            nullif(left(regexp_replace(coalesce(c.zip, ''), '[^0-9]', '', 'g'), 5), '')
        ) AS query_address
    FROM public.crexi_api_comps c
    CROSS JOIN scrape_run
    LEFT JOIN public.crexi_zillow_condo_xrefs x
      ON x.crexi_comp_id = c.id
    WHERE c.id >= p_start_id
      AND c.id < p_end_id_exclusive
      AND c.is_sales_comp IS TRUE
      AND c.exclude_from_sales_trends = false
      AND (
          x.crexi_comp_id IS NULL
          OR x.raw_json @> '[{"isValid": false, "invalidReason": "No valid input URLs or addresses"}]'::jsonb
      )
      AND c.address_street IS NOT NULL
      AND btrim(c.address_street) <> ''
      AND c.city IS NOT NULL
      AND btrim(c.city) <> ''
      AND c.state IS NOT NULL
      AND btrim(c.state) <> ''
      AND left(regexp_replace(coalesce(c.zip, ''), '[^0-9]', '', 'g'), 5) <> ''
    ORDER BY c.id
    LIMIT p_limit;
$$;

CREATE OR REPLACE FUNCTION public.backfill_crexi_zillow_condo_sales_trends_exclusions(
    p_start_id bigint,
    p_end_id_exclusive bigint
)
RETURNS TABLE(updated_count integer)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
    WITH matched_crexi_exclusions AS (
        SELECT
            c.id,
            coalesce(
                x.sales_trends_exclusion_reason,
                CASE
                    WHEN upper(coalesce(x.home_type, '')) IN ('CONDO', 'CONDOMINIUM') THEN 'zillow_home_type_condo'
                    WHEN upper(coalesce(x.home_type, '')) IN ('SINGLE_FAMILY', 'SINGLEFAMILY') THEN 'zillow_home_type_single_family'
                END
            ) AS exclusion_reason
        FROM public.crexi_api_comps c
        JOIN public.crexi_zillow_condo_xrefs x
          ON x.crexi_comp_id = c.id
        WHERE c.id >= p_start_id
          AND c.id < p_end_id_exclusive
          AND c.is_sales_comp IS TRUE
          AND c.exclude_from_sales_trends = false
          AND (
              x.is_sales_trends_excluded = true
              OR upper(coalesce(x.home_type, '')) IN ('CONDO', 'CONDOMINIUM', 'SINGLE_FAMILY', 'SINGLEFAMILY')
          )
    ),
    updated AS (
        UPDATE public.crexi_api_comps c
        SET exclude_from_sales_trends = true,
            sales_trends_exclusion_reason = m.exclusion_reason
        FROM matched_crexi_exclusions m
        WHERE c.id = m.id
        RETURNING c.id
    )
    SELECT count(*)::integer AS updated_count
    FROM updated;
$$;
