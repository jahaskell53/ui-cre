ALTER TABLE "loopnet_listings"
ADD COLUMN IF NOT EXISTS "om_cap_rate" text,
ADD COLUMN IF NOT EXISTS "om_cost_per_door" text,
ADD COLUMN IF NOT EXISTS "om_coc_return" text,
ADD COLUMN IF NOT EXISTS "om_grm" text,
ADD COLUMN IF NOT EXISTS "om_metrics_extracted_at" timestamp with time zone;
