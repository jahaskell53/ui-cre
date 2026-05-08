-- Exclude Crexi sales comps that Zillow identifies as condos.
--
-- `cleaned_listings.home_type = 'CONDO'` is the Zillow cross-reference signal.
-- The Dagster backfill calls the function below in bounded Crexi id partitions
-- so the production update stays chunked and retryable.

CREATE INDEX IF NOT EXISTS idx_cleaned_listings_zillow_condo_xref
ON public.cleaned_listings (
    lower(btrim(address_street)),
    lower(btrim(address_city)),
    upper(btrim(address_state)),
    left(regexp_replace(coalesce(address_zip, zip_code, ''), '[^0-9]', '', 'g'), 5)
)
WHERE home_type = 'CONDO';

CREATE OR REPLACE FUNCTION public.backfill_crexi_zillow_condo_sales_trends_exclusions(
    p_start_id bigint,
    p_end_id_exclusive bigint
)
RETURNS TABLE(updated_count integer)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
    WITH zillow_condo_addresses AS (
        SELECT DISTINCT
            lower(btrim(address_street)) AS street_key,
            lower(btrim(address_city)) AS city_key,
            upper(btrim(address_state)) AS state_key,
            left(regexp_replace(coalesce(address_zip, zip_code, ''), '[^0-9]', '', 'g'), 5) AS zip_key
        FROM public.cleaned_listings
        WHERE home_type = 'CONDO'
          AND address_street IS NOT NULL
          AND btrim(address_street) <> ''
          AND address_city IS NOT NULL
          AND btrim(address_city) <> ''
          AND address_state IS NOT NULL
          AND btrim(address_state) <> ''
          AND left(regexp_replace(coalesce(address_zip, zip_code, ''), '[^0-9]', '', 'g'), 5) <> ''
    ),
    matched_crexi_condos AS (
        SELECT c.id
        FROM public.crexi_api_comps c
        JOIN zillow_condo_addresses z
          ON z.street_key = lower(btrim(c.address_street))
         AND z.city_key = lower(btrim(c.city))
         AND z.state_key = upper(btrim(c.state))
         AND z.zip_key = left(regexp_replace(coalesce(c.zip, ''), '[^0-9]', '', 'g'), 5)
        WHERE c.id >= p_start_id
          AND c.id < p_end_id_exclusive
          AND c.is_sales_comp IS TRUE
          AND c.exclude_from_sales_trends = false
          AND c.address_street IS NOT NULL
          AND btrim(c.address_street) <> ''
          AND c.city IS NOT NULL
          AND btrim(c.city) <> ''
          AND c.state IS NOT NULL
          AND btrim(c.state) <> ''
          AND left(regexp_replace(coalesce(c.zip, ''), '[^0-9]', '', 'g'), 5) <> ''
    ),
    updated AS (
        UPDATE public.crexi_api_comps c
        SET exclude_from_sales_trends = true
        FROM matched_crexi_condos m
        WHERE c.id = m.id
        RETURNING c.id
    )
    SELECT count(*)::integer AS updated_count
    FROM updated;
$$;
