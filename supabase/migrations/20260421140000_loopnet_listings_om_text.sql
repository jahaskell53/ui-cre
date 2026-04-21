ALTER TABLE "loopnet_listings"
ADD COLUMN IF NOT EXISTS "om_text" text,
ADD COLUMN IF NOT EXISTS "om_text_extracted_at" timestamp with time zone;
