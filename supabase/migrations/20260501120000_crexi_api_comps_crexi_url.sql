-- Deep link to Crexi property record (Supabase Table Editor shows text URLs as links).
ALTER TABLE public.crexi_api_comps
    ADD COLUMN crexi_url text GENERATED ALWAYS AS (
        CASE
            WHEN crexi_id IS NOT NULL AND btrim(crexi_id) <> '' THEN
                'https://www.crexi.com/property-records/' || btrim(crexi_id)
        END
    ) STORED;
