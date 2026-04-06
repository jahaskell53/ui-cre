-- Remove townhouse records from cleaned_listings so they are excluded everywhere downstream.
DELETE FROM public.cleaned_listings
WHERE home_type = 'TOWNHOUSE';
