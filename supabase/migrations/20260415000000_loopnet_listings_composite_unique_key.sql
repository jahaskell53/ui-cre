-- Change the unique constraint on loopnet_listings from listing_url alone
-- to (listing_url, run_id) so that each scrape run creates new rows for
-- existing listings, enabling Latest vs Historical filtering (mirroring
-- how cleaned_listings uses a (zpid, run_id) composite unique key).

DROP INDEX IF EXISTS loopnet_listings_listing_url_key;

CREATE UNIQUE INDEX loopnet_listings_listing_url_run_id_key
    ON loopnet_listings (listing_url, run_id);
