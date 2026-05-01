-- Deep link to Crexi property record (Supabase Table Editor shows text URLs as links).
--
-- Adding a STORED generated column backfills every row; default Supabase statement_timeout
-- (~2 min) caused CI db push to fail with SQLSTATE 57014 on production-sized crexi_api_comps.

SET statement_timeout = '30min';

ALTER TABLE public.crexi_api_comps
    ADD COLUMN crexi_url text GENERATED ALWAYS AS (
        CASE
            WHEN crexi_id IS NOT NULL AND btrim(crexi_id) <> '' THEN
                'https://www.crexi.com/property-records/' || btrim(crexi_id)
        END
    ) STORED;
