-- Drop legacy insert_cleaned_listing overloads that contain the p_is_sfr
-- parameter. The p_is_sfr column was removed from the schema but the old
-- function signatures were never cleaned up. PostgREST cannot disambiguate
-- between the current overload and the legacy ones (PGRST203), causing every
-- call from the cleaned_listings Dagster asset to fail silently.
--
-- Overload 1 (oldest): has p_is_sfr, no p_home_type
-- Overload 3 (intermediate): has both p_is_sfr and p_home_type
--
-- Overload 2 (current, kept): no p_is_sfr, has p_home_type
--   This is the only one called by the pipeline.

DROP FUNCTION IF EXISTS public.insert_cleaned_listing(
    text, timestamp with time zone, text, text, text, text, text, text, text,
    integer, integer, numeric, integer, date,
    double precision, double precision,
    boolean,  -- p_is_sfr
    uuid, text, text, boolean, text
);

DROP FUNCTION IF EXISTS public.insert_cleaned_listing(
    text, timestamp with time zone, text, text, text, text, text, text, text,
    integer, integer, numeric, integer, date,
    double precision, double precision,
    boolean,  -- p_is_sfr
    uuid, text, text, boolean, text, text
);
