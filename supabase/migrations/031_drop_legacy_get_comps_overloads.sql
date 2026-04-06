-- Remove obsolete get_comps overloads. The app and integration tests call the
-- variant that ends with p_home_type (see 030_get_comps_prefiltered_align_with_main.sql).

DROP FUNCTION IF EXISTS public.get_comps(
  double precision,
  double precision,
  double precision,
  integer,
  integer,
  numeric,
  integer,
  integer,
  numeric,
  boolean,
  integer,
  text,
  boolean,
  integer[]
);

DROP FUNCTION IF EXISTS public.get_comps(
  double precision,
  double precision,
  double precision,
  integer,
  integer,
  numeric,
  integer,
  integer,
  text,
  integer,
  text,
  boolean,
  integer[]
);
