-- Create crexi_api_comps table and supporting index.
--
-- This table was originally created via Drizzle migrations (drizzle/ folder).
-- This Supabase migration brings it into the supabase/migrations/ history so
-- the local CI stack (used by PostgREST RPC resolution and integration tests)
-- has the table before the Crexi sales trends RPCs run.

CREATE TABLE IF NOT EXISTS public.crexi_api_comps (
    id bigserial PRIMARY KEY,
    crexi_id text UNIQUE,
    property_name text,
    document_type text,
    address_full text,
    address_street text,
    city text,
    state text,
    zip text,
    county text,
    latitude double precision,
    longitude double precision,
    property_type text,
    property_subtype text,
    building_sqft integer,
    num_units integer,
    address_count integer,
    is_sales_comp boolean,
    is_public_sales_comp boolean,
    is_broker_reported_sales_comp boolean,
    is_lease_comp boolean,
    sale_type text,
    days_on_market integer,
    date_activated text,
    date_updated text,
    description text,
    raw_json jsonb,
    scraped_at timestamp with time zone DEFAULT now(),
    property_price_total double precision,
    property_price_per_sqft double precision,
    property_price_per_acre double precision,
    sale_transaction_date text,
    sale_cap_rate_percent double precision,
    financials_cap_rate_percent double precision,
    financials_noi double precision,
    occupancy_rate_percent double precision,
    year_built integer,
    lot_size_sqft double precision,
    lot_size_acre double precision,
    zoning text,
    is_opportunity_zone boolean,
    owner_name text,
    is_corporate_owner boolean,
    is_crexi_source boolean,
    investment_type text,
    stories_count integer,
    construction_type text,
    class_type text
);

-- Functional spatial index so ST_Within queries on lat/lng are fast enough
-- to avoid statement timeouts in the county / neighborhood / MSA RPCs.
CREATE INDEX IF NOT EXISTS crexi_api_comps_geom_idx
    ON public.crexi_api_comps
    USING gist (ST_SetSRID(ST_Point(longitude, latitude), 4326))
    WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
