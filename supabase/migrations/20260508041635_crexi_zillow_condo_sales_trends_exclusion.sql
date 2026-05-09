-- Store per-Crexi Zillow scrape results, then exclude rows Zillow classifies as condos.
--
-- The Dagster backfill scrapes Zillow by Crexi address in bounded id partitions,
-- upserts the raw response and parsed home_type here, then calls the exclusion
-- function below. This avoids assuming the rental-oriented Zillow tables already
-- contain the Crexi sale properties.

CREATE TABLE IF NOT EXISTS public.crexi_zillow_condo_xrefs (
    id bigserial PRIMARY KEY,
    run_id text NOT NULL,
    crexi_comp_id bigint NOT NULL REFERENCES public.crexi_api_comps(id) ON DELETE CASCADE,
    crexi_id text,
    query_address text NOT NULL,
    zpid text,
    zillow_url text,
    home_type text,
    is_condo boolean NOT NULL DEFAULT false,
    raw_json jsonb NOT NULL DEFAULT '[]'::jsonb,
    scraped_at timestamp with time zone NOT NULL DEFAULT now(),
    created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS crexi_zillow_condo_xrefs_crexi_comp_id_key
    ON public.crexi_zillow_condo_xrefs (crexi_comp_id);

CREATE INDEX IF NOT EXISTS idx_crexi_zillow_condo_xrefs_is_condo
    ON public.crexi_zillow_condo_xrefs (crexi_comp_id)
    WHERE is_condo = true;

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
      AND x.crexi_comp_id IS NULL
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
    WITH matched_crexi_condos AS (
        SELECT c.id
        FROM public.crexi_api_comps c
        JOIN public.crexi_zillow_condo_xrefs x
          ON x.crexi_comp_id = c.id
        WHERE c.id >= p_start_id
          AND c.id < p_end_id_exclusive
          AND c.is_sales_comp IS TRUE
          AND c.exclude_from_sales_trends = false
          AND x.is_condo = true
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
