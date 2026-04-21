-- One Apify detail payload per LoopNet listing URL (not tied to search run_id).
CREATE TABLE "loopnet_listing_details" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_url" text NOT NULL,
	"scraped_at" timestamp with time zone NOT NULL,
	"raw_json" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "loopnet_listing_details_listing_url_key" ON "loopnet_listing_details" USING btree ("listing_url");
--> statement-breakpoint
-- Seed from historical per-run detail scrapes (latest scrape per URL wins).
INSERT INTO "loopnet_listing_details" ("listing_url", "scraped_at", "raw_json")
SELECT DISTINCT ON ("listing_url")
	"listing_url",
	"scraped_at",
	"raw_json"
FROM "raw_loopnet_detail_scrapes"
WHERE "raw_json" IS NOT NULL
ORDER BY "listing_url", "scraped_at" DESC;
--> statement-breakpoint
GRANT SELECT ON TABLE public.loopnet_listing_details TO anon, authenticated;
--> statement-breakpoint
GRANT ALL ON TABLE public.loopnet_listing_details TO service_role;
--> statement-breakpoint
ALTER TABLE public.loopnet_listing_details ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "Enable read access for all users" ON public.loopnet_listing_details
	AS PERMISSIVE FOR SELECT TO public USING (true);
