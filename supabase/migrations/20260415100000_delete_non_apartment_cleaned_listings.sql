-- Delete all historical cleaned_listings rows where home_type is not APARTMENT.
-- Going forward the pipeline only processes APARTMENT listings; rows with
-- SINGLE_FAMILY, CONDO, TOWNHOUSE, MULTI_FAMILY, LOT, or any other type are
-- not needed and should not appear in queries.

DELETE FROM public.cleaned_listings
WHERE home_type IS DISTINCT FROM 'APARTMENT';
