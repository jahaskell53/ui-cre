-- Add income/expense/cap-rate-adjacent columns to crexi_api_comps that were
-- present in the Crexi API raw_json but never extracted on ingest.
--
-- New columns:
--   tax_amount            annual property tax (expense signal)
--   tax_parcel_value      assessed parcel value (cap rate reference benchmark)
--   tax_land_value        assessed land value
--   tax_improvement_value assessed improvement value
--   buildings_count       number of buildings on the parcel
--   footprint_sqft        building footprint area in sqft
--   sale_buyer            buyer name from saleTransaction
--   sale_seller           seller name from saleTransaction
--   loan_term             mortgage loan term in months
--   mortgage_recording_date date the mortgage was recorded
--   gross_rent_annual     annual gross rent income parsed from leaseRateRange.totalAnnual
--                         (present for ~13k broker-reported records; the raw value is a
--                         formatted string like "$48,600" or "$20,400 - $24,000"; we
--                         capture the lower bound as a numeric for use in cap rate
--                         derivation: implied cap rate ≈ NOI / price, where NOI can be
--                         estimated as gross_rent_annual × (1 - expense_ratio))

ALTER TABLE public.crexi_api_comps
    ADD COLUMN IF NOT EXISTS tax_amount              double precision,
    ADD COLUMN IF NOT EXISTS tax_parcel_value        double precision,
    ADD COLUMN IF NOT EXISTS tax_land_value          double precision,
    ADD COLUMN IF NOT EXISTS tax_improvement_value   double precision,
    ADD COLUMN IF NOT EXISTS buildings_count         integer,
    ADD COLUMN IF NOT EXISTS footprint_sqft          double precision,
    ADD COLUMN IF NOT EXISTS sale_buyer              text,
    ADD COLUMN IF NOT EXISTS sale_seller             text,
    ADD COLUMN IF NOT EXISTS loan_term               integer,
    ADD COLUMN IF NOT EXISTS mortgage_recording_date text,
    ADD COLUMN IF NOT EXISTS gross_rent_annual       double precision;

-- Backfill all new columns from raw_json for existing rows.
-- gross_rent_annual: strip currency symbol/commas/spaces and take the lower bound
-- of range values (e.g. "$20,400 - $24,000" → 20400).
UPDATE public.crexi_api_comps SET
    tax_amount              = (raw_json -> 'tax' ->> 'amount')::double precision,
    tax_parcel_value        = (raw_json -> 'tax' ->> 'parcelValue')::double precision,
    tax_land_value          = (raw_json -> 'tax' ->> 'landValue')::double precision,
    tax_improvement_value   = (raw_json -> 'tax' ->> 'improvementValue')::double precision,
    buildings_count         = (raw_json -> 'propertyAttributes' ->> 'buildingsCount')::integer,
    footprint_sqft          = (raw_json -> 'propertyAttributes' ->> 'footprintSqft')::double precision,
    sale_buyer              = raw_json -> 'saleTransaction' ->> 'buyer',
    sale_seller             = raw_json -> 'saleTransaction' ->> 'seller',
    loan_term               = (raw_json -> 'mortgageFinancials' ->> 'loanTerm')::integer,
    mortgage_recording_date = raw_json -> 'mortgageFinancials' ->> 'recordingDate',
    gross_rent_annual       = CASE
        WHEN raw_json -> 'leaseRateRange' ->> 'totalAnnual' IS NOT NULL
        THEN regexp_replace(
                 split_part(raw_json -> 'leaseRateRange' ->> 'totalAnnual', ' - ', 1),
                 '[$,\s]', '', 'g'
             )::double precision
        ELSE NULL
    END
WHERE raw_json IS NOT NULL;
