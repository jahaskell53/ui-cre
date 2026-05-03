-- Speed up get_crexi_sales_trends_bucket_listings.
--
-- Problems with the original implementation:
--
-- 1. Spatial paths (county / neighborhood / msa) used
--    ST_Within(ST_SetSRID(ST_Point(c.longitude, c.latitude), 4326), boundary.geom)
--    inside a correlated EXISTS.  This re-materialises the point per row and
--    bypasses crexi_api_comps_sales_trends_geom_idx (which is on c.geom).
--
-- 2. The large OR across all five area kinds prevented the planner from building
--    an efficient per-case join order; it tended toward a full seqscan of the
--    165k-row eligible set before evaluating the area predicate.
--
-- 3. The function was missing SET work_mem = '64MB' that was applied to every
--    other sales-trends RPC in 20260502000000_crexi_sales_trends_workmem_partial_gist.sql.
--
-- Fix: rewrite as PL/pgSQL with an IF/ELSIF dispatch block so each area kind
-- executes its own standalone SQL statement.  Spatial joins use the same
-- ST_Covers(boundary.geom, c.geom) + GiST-index pattern as the already-fast
-- get_crexi_sales_trends_by_county / _by_neighborhood / _by_msa RPCs.

CREATE OR REPLACE FUNCTION public.get_crexi_sales_trends_bucket_listings(
    p_area_kind        text,
    p_bucket_start     date,
    p_months_per_bucket integer DEFAULT 1,
    p_offset           integer  DEFAULT 0,
    p_limit            integer  DEFAULT 50,
    p_zip              text     DEFAULT NULL,
    p_city             text     DEFAULT NULL,
    p_state            text     DEFAULT NULL,
    p_county_name      text     DEFAULT NULL,
    p_geoid            text     DEFAULT NULL,
    p_neighborhood_ids integer[] DEFAULT NULL,
    p_min_units        integer  DEFAULT NULL,
    p_max_units        integer  DEFAULT NULL
)
RETURNS TABLE(
    id                         bigint,
    crexi_id                   text,
    property_name              text,
    address_full               text,
    city                       text,
    state                      text,
    zip                        text,
    property_price_total       double precision,
    num_units                  integer,
    price_per_door             double precision,
    sale_transaction_date      text,
    sale_cap_rate_percent      double precision,
    financials_cap_rate_percent double precision,
    total_count                bigint
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET work_mem = '64MB'
SET statement_timeout = '120s'
AS $$
DECLARE
    v_window_start date := p_bucket_start;
    v_window_end   date := (p_bucket_start + (GREATEST(1, COALESCE(p_months_per_bucket, 1)) || ' months')::interval)::date;
    v_offset       int  := GREATEST(0, COALESCE(p_offset, 0));
    v_limit        int  := LEAST(200, GREATEST(1, COALESCE(p_limit, 50)));
BEGIN
    IF p_area_kind = 'zip' THEN
        RETURN QUERY
        WITH base AS (
            SELECT
                c.id,
                c.crexi_id,
                c.property_name,
                c.address_full,
                c.city,
                c.state,
                c.zip,
                c.property_price_total,
                c.num_units,
                (c.property_price_total / c.num_units::double precision) AS price_per_door,
                c.sale_transaction_date,
                c.sale_cap_rate_percent,
                c.financials_cap_rate_percent
            FROM crexi_api_comps c
            WHERE
                c.is_sales_comp = true
                AND NOT c.exclude_from_sales_trends
                AND c.property_price_total IS NOT NULL AND c.property_price_total > 0
                AND c.num_units IS NOT NULL AND c.num_units > 0
                AND c.sale_transaction_date IS NOT NULL
                AND c.sale_transaction_date::date >= v_window_start
                AND c.sale_transaction_date::date <  v_window_end
                AND c.zip = p_zip
                AND (p_min_units IS NULL OR c.num_units >= p_min_units)
                AND (p_max_units IS NULL OR c.num_units <= p_max_units)
        )
        SELECT
            b.id, b.crexi_id, b.property_name, b.address_full,
            b.city, b.state, b.zip,
            b.property_price_total, b.num_units, b.price_per_door,
            b.sale_transaction_date, b.sale_cap_rate_percent,
            b.financials_cap_rate_percent,
            COUNT(*) OVER ()::bigint AS total_count
        FROM base b
        ORDER BY b.sale_transaction_date::date DESC, b.id DESC
        OFFSET v_offset LIMIT v_limit;

    ELSIF p_area_kind = 'city' THEN
        RETURN QUERY
        WITH base AS (
            SELECT
                c.id,
                c.crexi_id,
                c.property_name,
                c.address_full,
                c.city,
                c.state,
                c.zip,
                c.property_price_total,
                c.num_units,
                (c.property_price_total / c.num_units::double precision) AS price_per_door,
                c.sale_transaction_date,
                c.sale_cap_rate_percent,
                c.financials_cap_rate_percent
            FROM crexi_api_comps c
            WHERE
                c.is_sales_comp = true
                AND NOT c.exclude_from_sales_trends
                AND c.property_price_total IS NOT NULL AND c.property_price_total > 0
                AND c.num_units IS NOT NULL AND c.num_units > 0
                AND c.sale_transaction_date IS NOT NULL
                AND c.sale_transaction_date::date >= v_window_start
                AND c.sale_transaction_date::date <  v_window_end
                AND c.city  ILIKE p_city
                AND c.state ILIKE p_state
                AND (p_min_units IS NULL OR c.num_units >= p_min_units)
                AND (p_max_units IS NULL OR c.num_units <= p_max_units)
        )
        SELECT
            b.id, b.crexi_id, b.property_name, b.address_full,
            b.city, b.state, b.zip,
            b.property_price_total, b.num_units, b.price_per_door,
            b.sale_transaction_date, b.sale_cap_rate_percent,
            b.financials_cap_rate_percent,
            COUNT(*) OVER ()::bigint AS total_count
        FROM base b
        ORDER BY b.sale_transaction_date::date DESC, b.id DESC
        OFFSET v_offset LIMIT v_limit;

    ELSIF p_area_kind = 'county' THEN
        RETURN QUERY
        WITH base AS (
            SELECT
                c.id,
                c.crexi_id,
                c.property_name,
                c.address_full,
                c.city,
                c.state,
                c.zip,
                c.property_price_total,
                c.num_units,
                (c.property_price_total / c.num_units::double precision) AS price_per_door,
                c.sale_transaction_date,
                c.sale_cap_rate_percent,
                c.financials_cap_rate_percent
            FROM county_boundaries cb
            JOIN crexi_api_comps c
              ON c.geom IS NOT NULL
             AND ST_Covers(cb.geom, c.geom)
            WHERE
                cb.name_lsad ILIKE p_county_name
                AND cb.state = p_state
                AND c.is_sales_comp = true
                AND NOT c.exclude_from_sales_trends
                AND c.property_price_total IS NOT NULL AND c.property_price_total > 0
                AND c.num_units IS NOT NULL AND c.num_units > 0
                AND c.sale_transaction_date IS NOT NULL
                AND c.sale_transaction_date::date >= v_window_start
                AND c.sale_transaction_date::date <  v_window_end
                AND (p_min_units IS NULL OR c.num_units >= p_min_units)
                AND (p_max_units IS NULL OR c.num_units <= p_max_units)
        )
        SELECT
            b.id, b.crexi_id, b.property_name, b.address_full,
            b.city, b.state, b.zip,
            b.property_price_total, b.num_units, b.price_per_door,
            b.sale_transaction_date, b.sale_cap_rate_percent,
            b.financials_cap_rate_percent,
            COUNT(*) OVER ()::bigint AS total_count
        FROM base b
        ORDER BY b.sale_transaction_date::date DESC, b.id DESC
        OFFSET v_offset LIMIT v_limit;

    ELSIF p_area_kind = 'neighborhood' THEN
        RETURN QUERY
        WITH base AS (
            SELECT
                c.id,
                c.crexi_id,
                c.property_name,
                c.address_full,
                c.city,
                c.state,
                c.zip,
                c.property_price_total,
                c.num_units,
                (c.property_price_total / c.num_units::double precision) AS price_per_door,
                c.sale_transaction_date,
                c.sale_cap_rate_percent,
                c.financials_cap_rate_percent
            FROM neighborhoods n
            JOIN crexi_api_comps c
              ON c.geom IS NOT NULL
             AND ST_Covers(n.geom, c.geom)
            WHERE
                n.id = ANY(p_neighborhood_ids)
                AND c.is_sales_comp = true
                AND NOT c.exclude_from_sales_trends
                AND c.property_price_total IS NOT NULL AND c.property_price_total > 0
                AND c.num_units IS NOT NULL AND c.num_units > 0
                AND c.sale_transaction_date IS NOT NULL
                AND c.sale_transaction_date::date >= v_window_start
                AND c.sale_transaction_date::date <  v_window_end
                AND (p_min_units IS NULL OR c.num_units >= p_min_units)
                AND (p_max_units IS NULL OR c.num_units <= p_max_units)
        )
        SELECT
            b.id, b.crexi_id, b.property_name, b.address_full,
            b.city, b.state, b.zip,
            b.property_price_total, b.num_units, b.price_per_door,
            b.sale_transaction_date, b.sale_cap_rate_percent,
            b.financials_cap_rate_percent,
            COUNT(*) OVER ()::bigint AS total_count
        FROM base b
        ORDER BY b.sale_transaction_date::date DESC, b.id DESC
        OFFSET v_offset LIMIT v_limit;

    ELSIF p_area_kind = 'msa' THEN
        RETURN QUERY
        WITH base AS (
            SELECT
                c.id,
                c.crexi_id,
                c.property_name,
                c.address_full,
                c.city,
                c.state,
                c.zip,
                c.property_price_total,
                c.num_units,
                (c.property_price_total / c.num_units::double precision) AS price_per_door,
                c.sale_transaction_date,
                c.sale_cap_rate_percent,
                c.financials_cap_rate_percent
            FROM msa_boundaries mb
            JOIN crexi_api_comps c
              ON c.geom IS NOT NULL
             AND ST_Covers(mb.geom, c.geom)
            WHERE
                mb.geoid = p_geoid
                AND c.is_sales_comp = true
                AND NOT c.exclude_from_sales_trends
                AND c.property_price_total IS NOT NULL AND c.property_price_total > 0
                AND c.num_units IS NOT NULL AND c.num_units > 0
                AND c.sale_transaction_date IS NOT NULL
                AND c.sale_transaction_date::date >= v_window_start
                AND c.sale_transaction_date::date <  v_window_end
                AND (p_min_units IS NULL OR c.num_units >= p_min_units)
                AND (p_max_units IS NULL OR c.num_units <= p_max_units)
        )
        SELECT
            b.id, b.crexi_id, b.property_name, b.address_full,
            b.city, b.state, b.zip,
            b.property_price_total, b.num_units, b.price_per_door,
            b.sale_transaction_date, b.sale_cap_rate_percent,
            b.financials_cap_rate_percent,
            COUNT(*) OVER ()::bigint AS total_count
        FROM base b
        ORDER BY b.sale_transaction_date::date DESC, b.id DESC
        OFFSET v_offset LIMIT v_limit;

    END IF;
END;
$$;
