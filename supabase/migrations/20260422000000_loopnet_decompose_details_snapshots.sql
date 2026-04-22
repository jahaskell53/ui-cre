-- Decompose loopnet_listings into loopnet_listing_details (one row per URL)
-- and loopnet_listing_snapshots (price/cap-rate per run).

-- 1. Create loopnet_listing_details
CREATE TABLE IF NOT EXISTS public.loopnet_listing_details (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY NOT NULL,
    listing_url text NOT NULL,
    thumbnail_url text,
    broker_logo_url text,
    address text,
    address_raw text,
    address_street text,
    address_city text,
    address_state text,
    address_zip text,
    headline text,
    location text,
    city text,
    state text,
    zip text,
    price text,
    price_numeric integer,
    cap_rate text,
    building_category text,
    square_footage text,
    created_at timestamptz(6) DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamptz(6) DEFAULT CURRENT_TIMESTAMP,
    latitude double precision,
    longitude double precision,
    description text,
    date_on_market date,
    date_listed date,
    date_last_updated date,
    price_per_unit text,
    grm text,
    num_units integer,
    property_type text,
    property_subtype text,
    apartment_style text,
    building_class text,
    lot_size text,
    building_size text,
    num_stories integer,
    year_built integer,
    year_renovated integer,
    construction_status text,
    zoning text,
    zoning_district text,
    zoning_description text,
    parcel_number text,
    opportunity_zone boolean,
    is_auction boolean,
    sale_type text,
    broker_name text,
    broker_company text,
    broker_phone text,
    broker_email text,
    agent_profile_url text,
    agent_photo_url text,
    submarket_id integer,
    investment_highlights jsonb,
    highlights jsonb,
    amenities jsonb,
    unit_mix jsonb,
    images jsonb,
    attachments jsonb,
    links jsonb,
    broker_details jsonb,
    property_taxes jsonb,
    scraped_at timestamptz DEFAULT now() NOT NULL,
    om_url text,
    attachment_urls jsonb DEFAULT '[]'::jsonb,
    geom geometry(Point, 4326),
    om_text text,
    om_text_extracted_at timestamptz,
    om_cap_rate text,
    om_cost_per_door text,
    om_coc_return text,
    om_grm text,
    om_metrics_extracted_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS loopnet_listing_details_listing_url_key
    ON public.loopnet_listing_details USING btree (listing_url);

CREATE INDEX IF NOT EXISTS idx_loopnet_listing_details_address_city_state_lower
    ON public.loopnet_listing_details USING btree (lower(address_city), lower(address_state));

CREATE INDEX IF NOT EXISTS idx_loopnet_listing_details_geom
    ON public.loopnet_listing_details USING gist (geom)
    WHERE geom IS NOT NULL;

ALTER TABLE public.loopnet_listing_details ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'loopnet_listing_details'
        AND policyname = 'Enable read access for all users'
    ) THEN
        CREATE POLICY "Enable read access for all users"
            ON public.loopnet_listing_details
            FOR SELECT TO public USING (true);
    END IF;
END $$;

-- Grant service_role full access (matches loopnet_listings grants)
GRANT ALL ON public.loopnet_listing_details TO service_role;

-- 2. Create loopnet_listing_snapshots
CREATE TABLE IF NOT EXISTS public.loopnet_listing_snapshots (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY NOT NULL,
    listing_url text NOT NULL,
    run_id integer NOT NULL,
    price text,
    price_numeric integer,
    price_per_unit text,
    cap_rate text,
    grm text,
    date_last_updated date,
    scraped_at timestamptz DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS loopnet_listing_snapshots_url_run_key
    ON public.loopnet_listing_snapshots USING btree (listing_url, run_id);

CREATE INDEX IF NOT EXISTS idx_loopnet_listing_snapshots_run_id
    ON public.loopnet_listing_snapshots USING btree (run_id DESC NULLS FIRST);

CREATE INDEX IF NOT EXISTS idx_loopnet_listing_snapshots_scraped_at
    ON public.loopnet_listing_snapshots USING btree (scraped_at);

ALTER TABLE public.loopnet_listing_snapshots ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'loopnet_listing_snapshots'
        AND policyname = 'Enable read access for all users'
    ) THEN
        CREATE POLICY "Enable read access for all users"
            ON public.loopnet_listing_snapshots
            FOR SELECT TO public USING (true);
    END IF;
END $$;

GRANT ALL ON public.loopnet_listing_snapshots TO service_role;

-- 3. Backfill loopnet_listing_details from loopnet_listings
-- Use the row with the highest run_id for each listing_url
INSERT INTO public.loopnet_listing_details (
    listing_url, thumbnail_url, broker_logo_url,
    address, address_raw, address_street, address_city, address_state, address_zip,
    headline, location, city, state, zip,
    price, price_numeric, cap_rate, building_category, square_footage,
    created_at, updated_at, latitude, longitude, description,
    date_on_market, date_listed, date_last_updated,
    price_per_unit, grm, num_units, property_type, property_subtype,
    apartment_style, building_class, lot_size, building_size,
    num_stories, year_built, year_renovated, construction_status,
    zoning, zoning_district, zoning_description, parcel_number,
    opportunity_zone, is_auction, sale_type,
    broker_name, broker_company, broker_phone, broker_email,
    agent_profile_url, agent_photo_url, submarket_id,
    investment_highlights, highlights, amenities, unit_mix,
    images, attachments, links, broker_details, property_taxes,
    scraped_at, om_url, attachment_urls, geom,
    om_text, om_text_extracted_at,
    om_cap_rate, om_cost_per_door, om_coc_return, om_grm, om_metrics_extracted_at
)
SELECT DISTINCT ON (listing_url)
    listing_url, thumbnail_url, broker_logo_url,
    address, address_raw, address_street, address_city, address_state, address_zip,
    headline, location, city, state, zip,
    price, price_numeric, cap_rate, building_category, square_footage,
    created_at, updated_at, latitude, longitude, description,
    date_on_market, date_listed, date_last_updated,
    price_per_unit, grm, num_units, property_type, property_subtype,
    apartment_style, building_class, lot_size, building_size,
    num_stories, year_built, year_renovated, construction_status,
    zoning, zoning_district, zoning_description, parcel_number,
    opportunity_zone, is_auction, sale_type,
    broker_name, broker_company, broker_phone, broker_email,
    agent_profile_url, agent_photo_url, submarket_id,
    investment_highlights, highlights, amenities, unit_mix,
    images, attachments, links, broker_details, property_taxes,
    scraped_at, om_url, attachment_urls, geom,
    om_text, om_text_extracted_at,
    om_cap_rate, om_cost_per_door, om_coc_return, om_grm, om_metrics_extracted_at
FROM public.loopnet_listings
ORDER BY listing_url, run_id DESC NULLS LAST
ON CONFLICT (listing_url) DO NOTHING;

-- 4. Backfill loopnet_listing_snapshots from loopnet_listings
INSERT INTO public.loopnet_listing_snapshots (
    listing_url, run_id, price, price_numeric, price_per_unit,
    cap_rate, grm, date_last_updated, scraped_at
)
SELECT
    listing_url, run_id, price, price_numeric, price_per_unit,
    cap_rate, grm, date_last_updated, scraped_at
FROM public.loopnet_listings
WHERE run_id IS NOT NULL
ON CONFLICT (listing_url, run_id) DO NOTHING;

-- 5. Update sales trends RPCs to use the new tables
CREATE OR REPLACE FUNCTION public.get_sales_trends(
  p_zip text DEFAULT NULL
)
RETURNS TABLE(month_start date, median_price numeric, avg_cap_rate numeric, listing_count bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
AS $function$
  SELECT
    DATE_TRUNC('month', s.scraped_at)::date AS month_start,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY s.price_numeric)::numeric AS median_price,
    AVG((REGEXP_MATCH(s.cap_rate, '([0-9]+\.?[0-9]*)'))[1]::numeric) AS avg_cap_rate,
    COUNT(*) AS listing_count
  FROM loopnet_listing_snapshots s
  JOIN loopnet_listing_details d ON d.listing_url = s.listing_url
  WHERE
    s.price_numeric IS NOT NULL AND s.price_numeric > 0
    AND (p_zip IS NULL OR d.zip = p_zip)
  GROUP BY 1
  ORDER BY 1;
$function$;

CREATE OR REPLACE FUNCTION public.get_sales_trends_by_city(
  p_city text,
  p_state text
)
RETURNS TABLE(month_start date, median_price numeric, avg_cap_rate numeric, listing_count bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
AS $function$
  SELECT
    DATE_TRUNC('month', s.scraped_at)::date AS month_start,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY s.price_numeric)::numeric AS median_price,
    AVG((REGEXP_MATCH(s.cap_rate, '([0-9]+\.?[0-9]*)'))[1]::numeric) AS avg_cap_rate,
    COUNT(*) AS listing_count
  FROM loopnet_listing_snapshots s
  JOIN loopnet_listing_details d ON d.listing_url = s.listing_url
  WHERE
    s.price_numeric IS NOT NULL AND s.price_numeric > 0
    AND d.city ILIKE p_city
    AND d.state ILIKE p_state
  GROUP BY 1
  ORDER BY 1;
$function$;

CREATE OR REPLACE FUNCTION public.get_sales_trends_by_county(
  p_county_name text,
  p_state text
)
RETURNS TABLE(month_start date, median_price numeric, avg_cap_rate numeric, listing_count bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
AS $function$
  SELECT
    DATE_TRUNC('month', s.scraped_at)::date AS month_start,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY s.price_numeric)::numeric AS median_price,
    AVG((REGEXP_MATCH(s.cap_rate, '([0-9]+\.?[0-9]*)'))[1]::numeric) AS avg_cap_rate,
    COUNT(*) AS listing_count
  FROM loopnet_listing_snapshots s
  JOIN loopnet_listing_details d ON d.listing_url = s.listing_url
  JOIN county_boundaries cb
    ON ST_Within(ST_SetSRID(ST_Point(d.longitude, d.latitude), 4326), cb.geom)
  WHERE
    s.price_numeric IS NOT NULL AND s.price_numeric > 0
    AND d.latitude IS NOT NULL AND d.longitude IS NOT NULL
    AND cb.name ILIKE p_county_name
    AND cb.state = p_state
  GROUP BY 1
  ORDER BY 1;
$function$;

CREATE OR REPLACE FUNCTION public.get_sales_trends_by_msa(
  p_geoid text
)
RETURNS TABLE(month_start date, median_price numeric, avg_cap_rate numeric, listing_count bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
AS $function$
  SELECT
    DATE_TRUNC('month', s.scraped_at)::date AS month_start,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY s.price_numeric)::numeric AS median_price,
    AVG((REGEXP_MATCH(s.cap_rate, '([0-9]+\.?[0-9]*)'))[1]::numeric) AS avg_cap_rate,
    COUNT(*) AS listing_count
  FROM loopnet_listing_snapshots s
  JOIN loopnet_listing_details d ON d.listing_url = s.listing_url
  JOIN msa_boundaries mb
    ON ST_Within(ST_SetSRID(ST_Point(d.longitude, d.latitude), 4326), mb.geom)
  WHERE
    s.price_numeric IS NOT NULL AND s.price_numeric > 0
    AND d.latitude IS NOT NULL AND d.longitude IS NOT NULL
    AND mb.geoid = p_geoid
  GROUP BY 1
  ORDER BY 1;
$function$;

CREATE OR REPLACE FUNCTION public.get_sales_trends_by_neighborhood(
  p_neighborhood_ids integer[]
)
RETURNS TABLE(month_start date, median_price numeric, avg_cap_rate numeric, listing_count bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
AS $function$
  SELECT
    DATE_TRUNC('month', s.scraped_at)::date AS month_start,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY s.price_numeric)::numeric AS median_price,
    AVG((REGEXP_MATCH(s.cap_rate, '([0-9]+\.?[0-9]*)'))[1]::numeric) AS avg_cap_rate,
    COUNT(*) AS listing_count
  FROM loopnet_listing_snapshots s
  JOIN loopnet_listing_details d ON d.listing_url = s.listing_url
  JOIN neighborhoods n
    ON ST_Within(ST_SetSRID(ST_Point(d.longitude, d.latitude), 4326), n.geom)
  WHERE
    s.price_numeric IS NOT NULL AND s.price_numeric > 0
    AND d.latitude IS NOT NULL AND d.longitude IS NOT NULL
    AND n.id = ANY(p_neighborhood_ids)
  GROUP BY 1
  ORDER BY 1;
$function$;
