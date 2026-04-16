-- Delete all historical cleaned_listings rows where home_type is not APARTMENT
-- or CONDO.  Going forward the pipeline only processes those two types; rows
-- with SINGLE_FAMILY, TOWNHOUSE, MULTI_FAMILY, LOT, or any other type are not
-- needed and should not appear in queries.

DELETE FROM public.cleaned_listings
WHERE home_type NOT IN ('APARTMENT', 'CONDO') OR home_type IS NULL;
