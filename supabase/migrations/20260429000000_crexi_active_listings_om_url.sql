ALTER TABLE "crexi_active_listings"
ADD COLUMN IF NOT EXISTS "om_url" text,
ADD COLUMN IF NOT EXISTS "attachment_urls" jsonb NOT NULL DEFAULT '[]'::jsonb;
