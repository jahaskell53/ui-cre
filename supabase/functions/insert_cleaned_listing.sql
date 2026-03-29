CREATE OR REPLACE FUNCTION public.insert_cleaned_listing(
  p_run_id text,
  p_scraped_at timestamp with time zone,
  p_zip_code text,
  p_zpid text,
  p_address_raw text,
  p_address_street text,
  p_address_city text,
  p_address_state text,
  p_address_zip text,
  p_price integer,
  p_beds integer,
  p_baths numeric,
  p_area integer,
  p_availability_date date,
  p_lat double precision,
  p_lng double precision,
  p_raw_scrape_id uuid DEFAULT NULL::uuid,
  p_img_src text DEFAULT NULL::text,
  p_detail_url text DEFAULT NULL::text,
  p_is_building boolean DEFAULT false,
  p_building_zpid text DEFAULT NULL::text,
  p_home_type text DEFAULT NULL::text
)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
BEGIN
    INSERT INTO cleaned_listings (
        run_id, scraped_at, zip_code, zpid,
        address_raw, address_street, address_city, address_state, address_zip,
        price, beds, baths, area, availability_date,
        geom, raw_scrape_id,
        img_src, detail_url, is_building, building_zpid, home_type
    ) VALUES (
        p_run_id, p_scraped_at, p_zip_code, p_zpid,
        p_address_raw, p_address_street, p_address_city, p_address_state, p_address_zip,
        p_price, p_beds, p_baths, p_area, p_availability_date,
        CASE WHEN p_lat IS NOT NULL AND p_lng IS NOT NULL
             THEN ST_SetSRID(ST_Point(p_lng, p_lat), 4326)
             ELSE NULL
        END,
        p_raw_scrape_id,
        p_img_src, p_detail_url, p_is_building, p_building_zpid, p_home_type
    )
    ON CONFLICT (zpid, run_id) DO NOTHING;
END;
$function$
