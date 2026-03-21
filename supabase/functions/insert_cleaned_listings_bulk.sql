CREATE OR REPLACE FUNCTION public.insert_cleaned_listings_bulk(rows jsonb)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
BEGIN
    INSERT INTO cleaned_listings (
        run_id, scraped_at, zip_code, zpid,
        address_raw, address_street, address_city, address_state, address_zip,
        price, beds, baths, area, availability_date,
        geom, is_sfr, raw_scrape_id,
        img_src, detail_url, is_building, building_zpid
    )
    SELECT
        r->>'run_id',
        (r->>'scraped_at')::timestamptz,
        r->>'zip_code',
        r->>'zpid',
        r->>'address_raw',
        r->>'address_street',
        r->>'address_city',
        r->>'address_state',
        r->>'address_zip',
        (r->>'price')::int,
        (r->>'beds')::int,
        (r->>'baths')::numeric,
        (r->>'area')::int,
        (r->>'availability_date')::date,
        CASE WHEN r->>'lat' IS NOT NULL AND r->>'lng' IS NOT NULL
             THEN ST_SetSRID(ST_Point((r->>'lng')::float, (r->>'lat')::float), 4326)
             ELSE NULL
        END,
        (r->>'is_sfr')::boolean,
        (r->>'raw_scrape_id')::uuid,
        r->>'img_src',
        r->>'detail_url',
        (r->>'is_building')::boolean,
        NULLIF(r->>'building_zpid', '')
    FROM jsonb_array_elements(rows) AS r
    ON CONFLICT (zpid, run_id) DO UPDATE SET
        scraped_at        = EXCLUDED.scraped_at,
        zip_code          = EXCLUDED.zip_code,
        address_raw       = EXCLUDED.address_raw,
        address_street    = EXCLUDED.address_street,
        address_city      = EXCLUDED.address_city,
        address_state     = EXCLUDED.address_state,
        address_zip       = EXCLUDED.address_zip,
        price             = EXCLUDED.price,
        beds              = EXCLUDED.beds,
        baths             = EXCLUDED.baths,
        area              = EXCLUDED.area,
        geom              = EXCLUDED.geom,
        img_src           = EXCLUDED.img_src,
        detail_url        = EXCLUDED.detail_url,
        is_building       = EXCLUDED.is_building,
        building_zpid     = EXCLUDED.building_zpid;
END;
$function$
