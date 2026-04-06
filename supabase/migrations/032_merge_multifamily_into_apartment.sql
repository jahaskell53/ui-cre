-- Merge MULTI_FAMILY into APARTMENT so apartment is the only residential multifamily option.
UPDATE cleaned_listings
SET home_type = 'APARTMENT'
WHERE home_type = 'MULTI_FAMILY';
