-- PR 2: Drop the legacy loopnet_listings table.
-- Application code was removed from loopnet_listings in PR 1 (#173).
DROP POLICY IF EXISTS "Enable read access for all users" ON public.loopnet_listings CASCADE;
DROP TABLE IF EXISTS public.loopnet_listings CASCADE;
