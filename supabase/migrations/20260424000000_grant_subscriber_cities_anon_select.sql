-- Grant full privileges on subscriber_cities and cities to all PostgREST roles.
-- Both tables were only granted to the legacy prisma role, causing PostgREST
-- to return permission denied (42501) when the newsletter prepare cron queried
-- subscribers with embedded subscriber_counties/subscriber_cities joins.
-- subscriber_cities missing grants: anon, authenticated, service_role, postgres
-- cities missing grants: anon, authenticated, service_role, postgres
GRANT ALL ON TABLE public.subscriber_cities TO anon;
GRANT ALL ON TABLE public.subscriber_cities TO authenticated;
GRANT ALL ON TABLE public.subscriber_cities TO service_role;
GRANT ALL ON TABLE public.subscriber_cities TO postgres;
GRANT ALL ON TABLE public.cities TO anon;
GRANT ALL ON TABLE public.cities TO authenticated;
GRANT ALL ON TABLE public.cities TO service_role;
GRANT ALL ON TABLE public.cities TO postgres;
