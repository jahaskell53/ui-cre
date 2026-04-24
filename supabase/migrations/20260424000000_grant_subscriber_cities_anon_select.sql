-- Grant SELECT on subscriber_cities to anon and authenticated roles.
-- subscriber_cities was missing this grant, causing PostgREST to return 401
-- when querying subscribers with the embedded subscriber_cities join using
-- the publishable (anon) key.
GRANT SELECT ON TABLE public.subscriber_cities TO anon;
GRANT SELECT ON TABLE public.subscriber_cities TO authenticated;
