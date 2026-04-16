-- Delete all historical cleaned_listings rows where home_type is not one of the
-- accepted types: APARTMENT, CONDO, TOWNHOUSE.  Rows with SINGLE_FAMILY,
-- MULTI_FAMILY, LOT, or any other type (including NULL) are not needed.

DELETE FROM public.cleaned_listings
WHERE home_type NOT IN ('APARTMENT', 'CONDO', 'TOWNHOUSE') OR home_type IS NULL;
