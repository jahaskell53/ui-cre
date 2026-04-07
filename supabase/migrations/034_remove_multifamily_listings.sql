-- Remove all multifamily listings from cleaned_listings
DELETE FROM cleaned_listings WHERE home_type = 'MULTI_FAMILY';
