-- Add columns to crexi_api_comps for fields already present in raw_json
-- but never extracted by the flatten() function.
--
-- New columns: apn, lender, loan_amount, loan_type, interest_rate,
--              mortgage_maturity_date, title_company
--
-- Existing schema columns that were also never populated by flatten()
-- (sale_cap_rate_percent, financials_cap_rate_percent, financials_noi,
--  occupancy_rate_percent, year_built, lot_size_sqft, lot_size_acre,
--  zoning, is_opportunity_zone, owner_name, is_corporate_owner,
--  is_crexi_source, investment_type, stories_count, construction_type,
--  class_type) are backfilled below alongside the new columns.

ALTER TABLE public.crexi_api_comps
    ADD COLUMN IF NOT EXISTS apn text,
    ADD COLUMN IF NOT EXISTS lender text,
    ADD COLUMN IF NOT EXISTS loan_amount double precision,
    ADD COLUMN IF NOT EXISTS loan_type text,
    ADD COLUMN IF NOT EXISTS interest_rate double precision,
    ADD COLUMN IF NOT EXISTS mortgage_maturity_date text,
    ADD COLUMN IF NOT EXISTS title_company text;

-- Backfill all previously un-extracted fields from raw_json for existing rows.
UPDATE public.crexi_api_comps SET
    -- address-level
    apn                     = raw_json -> 'address' -> 0 ->> 'apn',

    -- saleTransaction
    sale_cap_rate_percent   = (raw_json -> 'saleTransaction' ->> 'capRatePercent')::double precision,

    -- financials
    financials_cap_rate_percent = (raw_json -> 'financials' ->> 'capRatePercent')::double precision,
    financials_noi          = (raw_json -> 'financials' ->> 'netOperatingIncome')::double precision,

    -- occupancy
    occupancy_rate_percent  = (raw_json -> 'occupancyDetails' ->> 'occupancyRatePercent')::double precision,

    -- construction
    year_built              = (raw_json -> 'constructionYear' ->> 'built')::integer,

    -- lot attributes
    lot_size_sqft           = (raw_json -> 'lotAttributes' ->> 'sizeSqft')::double precision,
    lot_size_acre           = (raw_json -> 'lotAttributes' ->> 'sizeAcre')::double precision,
    zoning                  = raw_json -> 'lotAttributes' ->> 'zoning',
    is_opportunity_zone     = (raw_json -> 'lotAttributes' ->> 'isOpportunityZone')::boolean,

    -- ownership
    owner_name              = raw_json -> 'ownership' ->> 'ownerName',
    is_corporate_owner      = (raw_json -> 'ownership' ->> 'isCorporateOwner')::boolean,

    -- source / investment
    is_crexi_source         = (raw_json -> 'source' ->> 'isCrexi')::boolean,
    investment_type         = raw_json -> 'investmentType' ->> 'name',

    -- property attributes
    stories_count           = (raw_json -> 'propertyAttributes' ->> 'storiesCount')::integer,
    construction_type       = raw_json -> 'propertyAttributes' ->> 'constructionType',
    class_type              = raw_json -> 'propertyAttributes' ->> 'classType',

    -- mortgage financials
    lender                  = raw_json -> 'mortgageFinancials' ->> 'lender',
    loan_amount             = (raw_json -> 'mortgageFinancials' ->> 'loanAmount')::double precision,
    loan_type               = raw_json -> 'mortgageFinancials' ->> 'loanType',
    interest_rate           = (raw_json -> 'mortgageFinancials' ->> 'interestRate')::double precision,
    mortgage_maturity_date  = raw_json -> 'mortgageFinancials' ->> 'maturityDate',
    title_company           = raw_json -> 'mortgageFinancials' ->> 'titleCompany'
WHERE raw_json IS NOT NULL;
