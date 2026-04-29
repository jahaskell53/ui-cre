-- OPE-220: Cross-reference crexi_api_comps with crexi_comps_records to fill
-- cap rate gaps and track provenance.
--
-- 1. Add cap_rate_source column ('api' | 'export' | 'derived')
-- 2. Mark existing rows that already have a cap rate from the API as 'api'
-- 3. Backfill cap rate (and NOI) from crexi_comps_records where the API row
--    has no cap rate — joining on APN + sale date (year+month) + sold price
-- 4. Report coverage gain
--
-- Join strategy:
--   Primary key:   apn  (both tables have this)
--   Tiebreakers:   year+month of sale date, price within 1% tolerance
--
-- crexi_comps_records fields used:
--   closing_cap_rate  → sale_cap_rate_percent   (closing / actual)
--   asking_cap_rate   → financials_cap_rate_percent (listing/asking)
--   closing_noi       → financials_noi
--
-- Note: crexi_comps_records.sale_date is stored as text; we normalise both
-- sides to YYYY-MM via DATE_TRUNC / SUBSTRING so format differences don't block
-- the join.

-- ── 1. Add column ─────────────────────────────────────────────────────────────

ALTER TABLE public.crexi_api_comps
    ADD COLUMN IF NOT EXISTS cap_rate_source text;

-- ── 2. Tag rows that already have a cap rate from the API ─────────────────────

UPDATE public.crexi_api_comps
SET cap_rate_source = 'api'
WHERE cap_rate_source IS NULL
  AND (
      sale_cap_rate_percent IS NOT NULL
      OR financials_cap_rate_percent IS NOT NULL
  );

-- ── 3. Backfill from crexi_comps_records ──────────────────────────────────────
--
-- Matching logic:
--   a) apn must be non-null and equal on both sides
--   b) sale year+month must match (handles day-of-month discrepancies)
--   c) sold_price must be within 1% of property_price_total (guards against
--      APN reuse across different transactions)
--
-- When multiple export rows match a single API row we take the one with the
-- best cap rate coverage (DISTINCT ON + ORDER BY ... NULLS LAST).

UPDATE public.crexi_api_comps AS api
SET
    sale_cap_rate_percent       = COALESCE(api.sale_cap_rate_percent,       exp.closing_cap_rate),
    financials_cap_rate_percent = COALESCE(api.financials_cap_rate_percent, exp.asking_cap_rate),
    financials_noi              = COALESCE(api.financials_noi,              exp.closing_noi),
    cap_rate_source             = 'export'
FROM (
    SELECT DISTINCT ON (api_id)
        api_id,
        closing_cap_rate,
        asking_cap_rate,
        closing_noi
    FROM (
        SELECT
            a.id                         AS api_id,
            r.closing_cap_rate,
            r.asking_cap_rate,
            r.closing_noi
        FROM public.crexi_api_comps   a
        JOIN public.crexi_comps_records r
          ON  a.apn IS NOT NULL
          AND r.apn IS NOT NULL
          AND a.apn = r.apn
          -- year+month match on sale date
          AND TO_CHAR(a.sale_transaction_date::date, 'YYYY-MM')
              = SUBSTRING(r.sale_date FROM 1 FOR 7)
          -- price within 1% (NULL-safe: skip if either side is NULL)
          AND (
              a.property_price_total IS NULL
              OR r.sold_price        IS NULL
              OR ABS(a.property_price_total - r.sold_price)
                 / NULLIF(a.property_price_total, 0) < 0.01
          )
        WHERE
            a.cap_rate_source IS NULL   -- only rows not yet tagged
            AND (r.closing_cap_rate IS NOT NULL OR r.asking_cap_rate IS NOT NULL)
    ) sub
    -- prefer the export row that has closing_cap_rate; break ties by id
    ORDER BY api_id, (closing_cap_rate IS NOT NULL) DESC, closing_cap_rate DESC
) exp
WHERE api.id = exp.api_id;

-- ── 4. Coverage report ────────────────────────────────────────────────────────
--
-- This SELECT is informational only — it is printed to the migration log and
-- does not affect the schema or data.

DO $$
DECLARE
    total_comps            bigint;
    with_cap_rate          bigint;
    from_api               bigint;
    from_export            bigint;
    pct_covered            numeric;
BEGIN
    SELECT COUNT(*) INTO total_comps
    FROM public.crexi_api_comps
    WHERE is_sales_comp = true;

    SELECT COUNT(*) INTO with_cap_rate
    FROM public.crexi_api_comps
    WHERE is_sales_comp = true
      AND (sale_cap_rate_percent IS NOT NULL OR financials_cap_rate_percent IS NOT NULL);

    SELECT COUNT(*) INTO from_api
    FROM public.crexi_api_comps
    WHERE cap_rate_source = 'api';

    SELECT COUNT(*) INTO from_export
    FROM public.crexi_api_comps
    WHERE cap_rate_source = 'export';

    pct_covered := CASE WHEN total_comps > 0
                        THEN ROUND(with_cap_rate::numeric / total_comps * 100, 2)
                        ELSE 0 END;

    RAISE NOTICE 'OPE-220 cap rate coverage report:';
    RAISE NOTICE '  total sales comps          : %', total_comps;
    RAISE NOTICE '  rows with cap rate (total) : % (% %%)', with_cap_rate, pct_covered;
    RAISE NOTICE '  tagged api source          : %', from_api;
    RAISE NOTICE '  backfilled from export     : %', from_export;
END;
$$;
