-- Archive integer snapshot run 1 and legacy loopnet_listings rows with run_id = 1,
-- then renumber remaining runs so what was 2 becomes 1, 3 becomes 2, etc.

-- ── loopnet_listing_snapshots ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.loopnet_listing_snapshots_archived (
    LIKE public.loopnet_listing_snapshots INCLUDING DEFAULTS INCLUDING CONSTRAINTS
        EXCLUDING INDEXES
);

CREATE UNIQUE INDEX IF NOT EXISTS loopnet_listing_snapshots_archived_url_run_key
    ON public.loopnet_listing_snapshots_archived USING btree (listing_url, run_id);

CREATE INDEX IF NOT EXISTS idx_loopnet_listing_snapshots_archived_run_id
    ON public.loopnet_listing_snapshots_archived USING btree (run_id DESC NULLS FIRST);

CREATE INDEX IF NOT EXISTS idx_loopnet_listing_snapshots_archived_scraped_at
    ON public.loopnet_listing_snapshots_archived USING btree (scraped_at);

ALTER TABLE public.loopnet_listing_snapshots_archived ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'loopnet_listing_snapshots_archived'
        AND policyname = 'Enable read access for all users'
    ) THEN
        CREATE POLICY "Enable read access for all users"
            ON public.loopnet_listing_snapshots_archived
            FOR SELECT TO public USING (true);
    END IF;
END $$;

GRANT ALL ON public.loopnet_listing_snapshots_archived TO service_role;

INSERT INTO public.loopnet_listing_snapshots_archived
SELECT * FROM public.loopnet_listing_snapshots WHERE run_id = 1;

DELETE FROM public.loopnet_listing_snapshots WHERE run_id = 1;

-- Avoid (listing_url, run_id) conflicts while shifting: 2->1, 3->2, ...
UPDATE public.loopnet_listing_snapshots
SET run_id = -run_id
WHERE run_id > 1;

UPDATE public.loopnet_listing_snapshots
SET run_id = (-run_id) - 1
WHERE run_id < 0;

-- ── loopnet_listings (legacy full rows per run) ─────────────────────────────
CREATE TABLE IF NOT EXISTS public.loopnet_listings_archived (
    LIKE public.loopnet_listings INCLUDING DEFAULTS INCLUDING CONSTRAINTS
        EXCLUDING INDEXES
);

CREATE INDEX IF NOT EXISTS idx_loopnet_listings_archived_listing_url
    ON public.loopnet_listings_archived USING btree (listing_url);

CREATE INDEX IF NOT EXISTS idx_loopnet_listings_archived_address_city_state_lower
    ON public.loopnet_listings_archived USING btree (lower(address_city), lower(address_state));

CREATE UNIQUE INDEX IF NOT EXISTS loopnet_listings_archived_listing_url_run_id_key
    ON public.loopnet_listings_archived USING btree (listing_url, run_id);

CREATE INDEX IF NOT EXISTS idx_loopnet_listings_archived_geom
    ON public.loopnet_listings_archived USING gist (geom)
    WHERE geom IS NOT NULL;

ALTER TABLE public.loopnet_listings_archived ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'loopnet_listings_archived'
        AND policyname = 'Enable read access for all users'
    ) THEN
        CREATE POLICY "Enable read access for all users"
            ON public.loopnet_listings_archived
            FOR SELECT TO public USING (true);
    END IF;
END $$;

GRANT ALL ON public.loopnet_listings_archived TO service_role;

INSERT INTO public.loopnet_listings_archived
SELECT * FROM public.loopnet_listings WHERE run_id = 1;

DELETE FROM public.loopnet_listings WHERE run_id = 1;

UPDATE public.loopnet_listings
SET run_id = -run_id
WHERE run_id > 1;

UPDATE public.loopnet_listings
SET run_id = (-run_id) - 1
WHERE run_id < 0;
